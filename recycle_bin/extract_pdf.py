import fitz  # PyMuPDF
import sys

def pdf_to_images(pdf_path):
    doc = fitz.open(pdf_path)
    for page_num in range(min(5, len(doc))):  # Extract up to first 5 pages
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        output_path = f"pdf_page_{page_num + 1}.png"
        pix.save(output_path)
        print(f"Saved {output_path}")

if __name__ == "__main__":
    pdf_to_images("1-9 Buckingham road killara.PDF")
