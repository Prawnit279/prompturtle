/**
 * Standalone embedding generator — needs ONLY OPENAI_API_KEY, no DATABASE_URL.
 * Outputs embeddings as JSON to stdout, which gets saved to a file.
 * The file is then used to insert into embedding_store via Supabase MCP.
 */
import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const openai = new OpenAI();

const HTS_RECORDS = [
  { id: 'ce795adc-b9fe-4a00-a2c2-bb342d070e55', code: '0201.10.10', description: 'Carcasses and half-carcasses of bovine animals, fresh or chilled' },
  { id: '52ab2da2-a4cb-4f00-a2bc-740fa11c185a', code: '0207.12.00', description: 'Frozen chickens, not cut in pieces' },
  { id: '7c91d781-af86-403c-9856-fedea69c4ede', code: '0805.10.00', description: 'Oranges, fresh or dried' },
  { id: 'acd95c67-1d97-4f42-a873-6e4611dd3b69', code: '0901.11.00', description: 'Coffee, not roasted, not decaffeinated' },
  { id: '439615b4-21e3-4342-8e55-78fe304e2d3b', code: '2709.00.20', description: 'Petroleum oils and oils obtained from bituminous minerals, crude' },
  { id: '4fb68298-af92-4e69-a910-5e5e79684065', code: '3004.90.92', description: 'Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses, put up in measured doses' },
  { id: 'e910e55e-5b1e-45cf-a3bd-aab148458c7c', code: '3923.30.00', description: 'Carboys, bottles, flasks and similar articles, of plastics' },
  { id: '319474e1-e0eb-4dca-bf19-dace4fe6b8b0', code: '3926.90.99', description: 'Other articles of plastics, not elsewhere specified' },
  { id: 'fdbf13e8-1f84-47a7-ad92-f8b2ca957ac4', code: '6109.10.00', description: 'T-shirts, singlets and other vests, of cotton, knitted or crocheted' },
  { id: '19ec827a-ec18-4f70-a38c-265f15272897', code: '6203.42.40', description: "Men's or boys' trousers and breeches, of cotton, not bib and brace overalls" },
  { id: 'b8251e0f-b244-46f0-b2fc-9e2da452713e', code: '6204.62.40', description: "Women's or girls' trousers and breeches, of cotton" },
  { id: 'b3a36d68-695d-455b-bc6f-9068cc49f981', code: '7318.15.20', description: 'Screws and bolts of iron or steel, not stainless, threaded' },
  { id: 'fa86cc31-29bd-41a9-8dfa-56634235b5db', code: '7326.90.86', description: 'Other articles of iron or steel' },
  { id: '50bd89e0-02c2-40ef-9426-737948ef750b', code: '8443.31.10', description: 'Printers, for use with automatic data processing machines' },
  { id: 'c59246bb-0bdc-4388-8249-61e7ab5152c4', code: '8471.30.01', description: 'Portable automatic data processing machines, weighing not more than 10 kg' },
  { id: '7fcf86d3-b455-46c3-93cd-2f660540d093', code: '8471.41.01', description: 'Other automatic data processing machines comprising in the same housing at least a central processing unit and an input and output unit' },
  { id: 'ef8a6e64-7539-4f55-b643-2741cff34b9a', code: '8481.80.90', description: 'Taps, cocks, valves and similar appliances for pipes, tanks, vats' },
  { id: '5bccf5e2-728f-4b3e-b461-ff10d7542573', code: '8501.10.40', description: 'Electric motors of an output not exceeding 37.5 W' },
  { id: '27af7793-c7db-4d5b-9078-2c42d8aad443', code: '8517.12.00', description: 'Telephones for cellular networks or for other wireless networks' },
  { id: 'a42685e8-58dd-4acb-8eae-56c5b7e04a78', code: '8528.72.64', description: 'Television reception apparatus, LCD flat panel display, not capable of receiving television broadcast signals' },
  { id: '38d62796-99ce-411b-bc79-d010f452b112', code: '8544.42.90', description: 'Electric conductors fitted with connectors, for a voltage not exceeding 1,000 V' },
  { id: 'c422a523-b0d8-49cf-9aaf-3dcce04db9b0', code: '8703.23.00', description: 'Motor cars with spark-ignition internal combustion engine, cylinder capacity exceeding 1,500 cc but not exceeding 3,000 cc' },
  { id: 'ac0ab85a-727b-46c5-bb9b-39089bda1194', code: '8708.99.81', description: 'Other parts and accessories for motor vehicles' },
  { id: 'b209d71d-4770-41d4-a088-b070801f3dbc', code: '9401.61.40', description: 'Seats with wooden frames, upholstered, other than garden seats or camping equipment' },
  { id: '0b87d725-fa8c-40eb-a861-9f2ef97942b3', code: '9403.20.00', description: 'Other metal furniture' },
];

async function main() {
  console.error('Generating embeddings for', HTS_RECORDS.length, 'HTS codes...');

  const inputs = HTS_RECORDS.map(r => `HTS ${r.code}: ${r.description}`);

  const response = await openai.embeddings.create({
    model:      'text-embedding-3-small',
    input:      inputs,
    dimensions: 1536,
  });

  const results = HTS_RECORDS.map((r, i) => ({
    entityId:  r.id,
    code:      r.code,
    embedding: response.data[i]!.embedding,
  }));

  const outPath = path.join(process.cwd(), 'hts-embeddings.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 0));
  console.error('Done. Written to', outPath);
  console.error('Dims:', response.data[0]!.embedding.length);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
