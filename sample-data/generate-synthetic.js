import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, './');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function createPdf(filename, pagesData) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(OUTPUT_DIR, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    pagesData.forEach((pageContent, idx) => {
      if (idx > 0) doc.addPage();

      doc.fontSize(18).fillColor('#1E3A8A').text(pageContent.title, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6B7280').text(`Document: ${filename} | Page ${idx + 1} | Synthetic Test Data`);
      doc.moveDown(1.5);

      doc.fontSize(12).fillColor('#111827').lineGap(4);
      pageContent.paragraphs.forEach(para => {
        doc.text(para);
        doc.moveDown(0.8);
      });
    });

    doc.end();
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

async function generateAllSyntheticPdfs() {
  console.log('Generating synthetic demonstration PDFs...');

  // PDF 1: Annual Report FY23
  await createPdf('Synthetic_Acme_Annual_Report_FY23.pdf', [
    {
      title: 'Acme Corporation - Annual Report FY2023',
      paragraphs: [
        'Acme Corporation is a premier enterprise software and robotics provider.',
        'During the fiscal year ended March 31, 2023, revenue from operations was $100 million across all operating units.',
        'The company maintained an active workforce of 4,200 employees globally.',
        'In August 2021, the company completed the strategic acquisition of Spoton Logistics to strengthen its distribution footprint.',
      ],
    },
    {
      title: 'Financial Statements & Operations FY23',
      paragraphs: [
        'Total revenue for fiscal year 2023 reached $100 million, representing solid year-over-year stability.',
        'Net profit for FY2023 stood at $12 million, reflecting disciplined cost controls.',
        'Total pin codes covered across the nationwide distribution network reached 17,400+ pin codes.',
      ],
    },
  ]);

  // PDF 2: Investor Update FY24
  await createPdf('Synthetic_Acme_Investor_Update_FY24.pdf', [
    {
      title: 'Acme Corporation - FY24 Investor Presentation',
      paragraphs: [
        'Acme Corporation announces financial results for fiscal year 2024.',
        'FY2023 revenue reached $100M, reaffirming our baseline performance.',
        'For FY2024, total revenue from operations increased to $145M, driven by cloud expansion.',
        'As of March 31, 2024, total headcount stood at 5,200 employees worldwide.',
      ],
    },
    {
      title: 'Market Outlook & Expansion',
      paragraphs: [
        'In North America, our regional headcount stood at 2,100 employees as of Q4 FY24.',
        'The company expects growth of approximately 20-30% in international markets over unverified timelines.',
      ],
    },
  ]);

  // PDF 3: Press Release FY24
  await createPdf('Synthetic_Acme_Press_Release_FY24.pdf', [
    {
      title: 'Acme Corp Press Release - Corporate Update 2024',
      paragraphs: [
        'Acme Corporation today issued a correction to corporate disclosures.',
        'The company confirmed that total headcount for FY2024 was 4,700 employees globally, adjusting for seasonal contractor reductions.',
        'Total revenue for FY2024 reached $145M.',
      ],
    },
  ]);

  console.log('Synthetic PDFs generated in ./sample-data/');
}

generateAllSyntheticPdfs().catch(console.error);
