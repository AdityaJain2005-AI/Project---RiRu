import { ingestKnowledge } from "../lib/knowledge-store.ts";

const count = await ingestKnowledge();
console.log(`Stored ${count} knowledge chunks.`);
