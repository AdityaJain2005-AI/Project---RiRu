from flask import Flask, render_template, request
import os, re, json
import pytesseract
from PIL import Image

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Windows Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Optional: AI explanations. Paste your key here OR set ANTHROPIC_API_KEY env variable
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def clean_ingredients(text):
    """Turn messy OCR/pasted text into a clean ingredient list."""
    text = text.replace("\n", " ")
    # keep only the part after the word 'ingredients' if present
    m = re.search(r'ingredients?\s*[:\-]?\s*(.*)', text, re.IGNORECASE)
    if m:
        text = m.group(1)
    parts = re.split(r'[,;•·]', text)
    cleaned = []
    for p in parts:
        p = re.sub(r'[^A-Za-z0-9\s\-\/\(\)\.]', '', p).strip(' .')
        if 2 < len(p) < 60:
            cleaned.append(p)
    return cleaned


def explain_with_ai(ingredients):
    """Ask Claude for what each ingredient does. Returns list of dicts or None."""
    if not API_KEY:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=API_KEY)
        prompt = (
            "You are a skincare ingredient expert. For each ingredient below, return ONLY a JSON array "
            "(no other text) of objects with keys: name, function (short), concern "
            "(any irritation/comedogenic/allergen/pregnancy note, or 'None known'), "
            "rating ('good', 'neutral', or 'caution').\n\nIngredients: " + ", ".join(ingredients)
        )
        resp = client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r'^```(?:json)?|```$', '', raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception as e:
        print("AI error:", e)
        return None


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/scan', methods=['POST'])
def scan():
    raw_text = request.form.get('pasted_text', '').strip()
    file = request.files.get('product_image')

    if file and file.filename:
        path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(path)
        raw_text = pytesseract.image_to_string(Image.open(path))

    if not raw_text:
        return render_template('index.html', error="Please upload a photo or paste ingredient text.")

    ingredients = clean_ingredients(raw_text)
    if not ingredients:
        return render_template('index.html', error="Couldn't find ingredients. Try a clearer photo.", raw=raw_text)

    details = explain_with_ai(ingredients)
    return render_template('index.html', ingredients=ingredients, details=details, raw=raw_text)


if __name__ == '__main__':
    app.run(debug=True)