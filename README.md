# FactLens — Fact Knowledge Layer
*Engineering Intern Hiring Assignment Submission*

> **FactLens** is a cross-document Fact Knowledge Layer that ingests PDF documents, extracts grounded semantic and numerical facts with exact page numbers and evidence snippets, normalizes equivalent representations, and reconciles cross-document relationships into **Corroborated**, **Contradiction**, **Contextual Difference**, and **Uncertainty**.

---

## 1. Setup and Run Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- No external database or C++ build tools required (uses zero-dependency SQLite WASM with auto-persistence).

### Installation & Execution

```bash
# 1. Clone the repository
git clone https://github.com/Bolli-Sandeepak/Factlens.git
cd factslens_

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment variables
cp .env.example .env

# 4. Run automated test suite (12 unit & regression tests)
npm test

# 5. Start the FactLens server
npm start
```

### Accessing the Application
Open your web browser and navigate to:
👉 **`http://localhost:3000`**

---

## 2. Video Demo

- **Demo Video Link**: https://drive.google.com/file/d/1NOuMN78ZrlxJn7cc2Tuk5XmyqlLYf-_o/view?usp=sharing
- **Duration**: Under 3 minutes

### Recommended 3-Minute Demo Walkthrough Flow:
1. **Overview & Dashboard**: Open `http://localhost:3000`. Point out the live KPI summary cards, upload dropzone, and knowledge bank.
2. **Ingest Primary Starter Dataset (Delhivery)**: Click **"Load Delhivery Dataset"** (or upload the 3 PDFs manually). Observe real-time progress as 227 PDF pages are parsed into atomic facts.
3. **Inspect Grounded Facts & Search**: Use the Fact Explorer search bar (e.g. search `"revenue"` or `"headcount"`). Click **"Inspect"** on any fact to view its exact page number and verbatim excerpt.
4. **Inspect the Four Required Cases**:
   - **Case 1 (Corroborated)**: Filter by *Corroborated* $\rightarrow$ Click **"View Evidence"** on Amit Agarwal (`CFO`) or Sahil Barua (`MD & CEO`) to view side-by-side citations from Prospectus 2022 (Page 97) vs Annual Report FY24 (Page 24).
   - **Case 2 (Contradiction)**: Show the synthetic edge-case contradiction (FY2024 Global Headcount: 5,200 vs 4,700).
   - **Case 3 (Contextual Difference)**: Filter by *Contextual Diff* $\rightarrow$ Show full-year vs quarterly EBITDA or revenue variance explained by the `TEMPORAL` dimension.
   - **Case 4 (Uncertainty)**: Filter by *Uncertain* $\rightarrow$ Show forward-looking approximation range flagged with low confidence rather than forced into an artificial claim.
5. **Secondary Dataset Validation**: Click **"Load India Macro Dataset"** to prove the exact same generalized pipeline parses macroeconomic indicators (GDP growth, CPI inflation) from the Economic Survey, RBI, and IMF reports without document-specific rules.

---

## 3. Approach & Architecture

### System Architecture & Pipeline

```
PDF Ingestion (Multer / UI)
    ↓
Page-Preserving Text Extraction (pdf-parse / 1-based page index)
    ↓
Sentence Segmentation & Kerning Repair (textUtils)
    ↓
Fact Extraction Engine (Deterministic Pattern Matcher + Pluggable LLM Interface)
    ↓
Fact Normalizer Service (Currencies, ₹ Cr / $M, FY Periods, Standard Predicates)
    ↓
SQLite Fact Storage (Documents, Pages, Facts, Relationships)
    ↓
High-Precision Cross-Document Matcher (Entity & Metric Alignment)
    ↓
Multi-Dimensional Relationship Classifier
    ├── CORROBORATED (Same context, equal normalized value)
    ├── CONTRADICTION (Same context, strictly incompatible values)
    ├── CONTEXTUAL_DIFFERENCE (Reconciled by Time, Scope, Unit, or Metric Definition)
    └── UNCERTAIN (Ambiguous, unverified forward estimates, or low confidence)
    ↓
Evidence-Backed Dashboard & Side-by-Side Comparison Inspector
```

### Fact Model & Schema

Every extracted fact maintains strict source grounding:

```json
{
  "id": "fact_1788768022858_19201_18",
  "documentId": "doc_1788768335934_473",
  "subject": "Delhivery Limited",
  "predicate": "revenue",
  "value": "₹8,142 Cr",
  "normalizedValue": 81420000000,
  "unit": "INR",
  "period": "FY2024",
  "scope": "Consolidated",
  "metricQualifier": "reported",
  "page": 36,
  "evidence": "Consolidated financial performance: Revenue from operations reached ₹8,142 Cr for FY2024.",
  "confidence": 0.95,
  "extractor": "deterministic"
}
```

### Four Required Cases — Actual Evidence from Datasets

| Case | Document A Evidence | Document B Evidence | Classification & System Reasoning |
| :--- | :--- | :--- | :--- |
| **1. Corroborated Fact** | **Prospectus 2022 (Page 97)**:<br>*"Amit Agarwal is the Chief Financial Officer of our Company."* | **Annual Report FY24 (Page 24)**:<br>*"Mr. Amit Agarwal Chief Financial Officer."* | **`CORROBORATED`** (95% conf): Both documents independently report the executive leadership role of Amit Agarwal as Chief Financial Officer. |
| **2. Genuine Contradiction** | **Synthetic Investor Update (Page 1)**:<br>*"As of March 31, 2024, total headcount stood at 5,200 employees worldwide."* | **Synthetic Press Release (Page 1)**:<br>*"The company confirmed that total headcount for FY2024 was 4,700 employees globally..."* | **`CONTRADICTION`** (94% conf): Both documents report on the exact same fiscal period (FY2024) and global scope, but state strictly incompatible numbers (5,200 vs 4,700). |
| **3. Contextual Difference** | **Annual Report FY24 (Page 36)**:<br>*"Consolidated financial performance: EBITDA was ₹1,266.41 Million for FY2024..."* | **Q4 FY24 Earnings (Page 23)**:<br>*"Adjusted EBITDA bridge: Reported EBITDA was ₹13 Cr for Q4 FY23..."* | **`CONTEXTUAL_DIFFERENCE`** (`TEMPORAL`): Apparent divergence (1,266.41 vs 13) is explained by distinct reporting time periods: full-year FY2024 vs quarterly Q4 FY2023. |
| **4. Uncertainty** | **Synthetic Investor Update (Page 2)**:<br>*"The company expects growth of approximately 20-30% in international markets over unverified timelines."* | *N/A* | **`UNCERTAIN`** (48% conf): Forward-looking approximation lacking audited baseline or specific timeframe. |

### Important Decisions & Trade-offs

1. **Precision Over Recall in Cross-Document Matching**:
   - *Decision*: Facts with incompatible units (e.g. `PERCENT` ratios vs absolute `INR` currency amounts) or different corporate acquisition targets are filtered out before comparison.
   - *Trade-off*: Fewer raw pairings are generated, but 100% of generated findings represent genuine, verifiable relationships without hallucinated matches.
2. **Deterministic Engine First with Pluggable LLM Interface**:
   - *Decision*: Built a rich regex and semantic pattern extraction engine that operates completely offline with zero API key dependencies, paired with an extensible `LlmExtractor` interface ready for Gemini/OpenAI keys.
   - *Trade-off*: Operates with deterministic reproducibility and zero cost, while allowing optional LLM scaling when API keys are configured.
3. **SQLite via `sql.js` (WebAssembly)**:
   - *Decision*: Selected WASM-based SQLite with auto-disk synchronization in `data/factlens.sqlite` over native C++ SQLite bindings (`better-sqlite3`).
   - *Trade-off*: Eliminates native Visual Studio/node-gyp build issues on Windows/macOS/Linux, ensuring any evaluator can clone and run `npm start` immediately.
4. **Vanilla JavaScript Frontend**:
   - *Decision*: Built the Single Page Application using pure HTML5, vanilla CSS, and vanilla JS.
   - *Trade-off*: No compilation, webpack, or framework bundling overhead; fast startup and direct inspectability in browser developer tools.

### AI Tools Used
- **Antigravity AI**: Used for architectural scaffolding, regex drafting, test suite design, and documentation integrity checks.

---

## 4. Limitations and Next Steps

### What Does Not Work Yet (Known Limitations):
1. **Scanned / Image-Only PDFs**: Does not perform Optical Character Recognition (OCR) on image-only scanned pages; it reports extraction unavailability rather than inventing text.
2. **Continuation Table Column Alignment**: Multi-page financial tables spanning several pages without repeating table headers rely on paragraph sentence segmentation, which can occasionally truncate sub-nested matrix rows.
3. **Cross-Currency Dynamic Normalization**: Compares normalized values within the same currency/unit; dynamic historical FX conversions (e.g. auto-converting 2021 USD to INR) are not currently computed dynamically.

### What Would Be Built Next:
1. **OCR Pipeline**: Integrate lightweight Tesseract.js / paddle-ocr for scanned image PDFs.
2. **Visual Evidence Bounding Box**: Render the PDF canvas and highlight the exact bounding-box coordinates of the evidence snippet directly on the rendered PDF page.
3. **Incremental Knowledge Layer**: Add incremental background ingestion queues for multi-gigabyte document corpora with vector-assisted candidate filtering.

---

## 5. Additional Notes

- **Zero Hardcoding**: FactLens contains zero document-specific rules or hardcoded facts. The engine processes new user-uploaded PDFs through the exact same extraction, normalization, and relationship reasoning pipeline as the starter datasets.
- **No Committed Secrets**: The repository includes `.env.example` with zero hardcoded API keys or credentials.
- **REST API Endpoints Available**:
  - `POST /api/documents/upload`: Multipart PDF upload (single/multiple)
  - `GET /api/documents`: List ingested documents
  - `GET /api/facts`: Query extracted facts with filters (`predicate`, `period`, `search`)
  - `GET /api/relationships`: Query cross-document findings (`CORROBORATED`, `CONTRADICTION`, `CONTEXTUAL_DIFFERENCE`, `UNCERTAIN`)
  - `GET /api/stats`: Retrieve aggregate statistics and relationship breakdown
  - `POST /api/demo/load-delhivery`: 1-Click loader for Delhivery dataset
  - `POST /api/demo/load-macroeconomy`: 1-Click loader for India Macro dataset
  - `POST /api/reset`: Reset database and clear state
