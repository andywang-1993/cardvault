# ATL CardVault — Executive Stakeholder & Business Card Hub

A responsive web application designed for **Account Technical Leaders (ATLs)**, Client Technical Specialists, and Enterprise Architects to store, organize, scan, and retrieve client business cards, stakeholder hierarchies, and technical account intelligence.

---

## 🌟 Key Features

### 1. 📇 3D Tactile Business Card Viewer & Deck
- **Interactive 3D Flip Physics**: Click any card or button to inspect the Front (Identity, Title, Direct Contact) and Back (Tech Focus, Alignment, Architecture notes).
- **Executive Card Themes**: Modern tactile finishes (Executive Navy, Cyber Slate, Emerald Matrix, Gold Prestige, Electric Violet, Teal Modern).
- **Dual Display Modes**: Toggle between 3D Card Gallery and a compact searchable list table.

### 2. 🤖 AI / Smart Card Scanner (Client-Side OCR)
- **Instant Image Extraction**: Drag and drop or take a photo of physical business cards (PNG, JPG, WebP).
- **OCR Engine**: Powered by client-side OCR (`Tesseract.js`) with an intelligent regex parser that detects Name, Title, Company, Phone, Email, and Tech tags.
- **Privacy First**: 100% runs in your browser — zero client card data or sensitive contact information is uploaded to external servers.

### 3. 🏛️ Account Stakeholder & Power Map (Org Matrix)
- Categorizes client contacts by enterprise account into a **4-Quadrant Decision Matrix**:
  - 💰 **Economic Buyers** (CIO, VP Tech, Sourcing Leaders)
  - 🛡️ **Technical Champions** (Chief Enterprise Architects, AI Leads)
  - ✨ **Influencers** (Domain Specialists, Clinical/Business leads)
  - 🔒 **Gatekeepers & Sec** (CISO, Risk & Compliance)
- Tracks annual spend, tier, and active enterprise initiatives.

### 4. ⚡ Instant Retrieval & Multi-Faceted Filters
- **Fuzzy Search**: Filter by Name, Company, Job Title, or specific technology stacks (e.g., `watsonx`, `OpenShift`, `Quantum`, `Mainframe`, `FinOps`).
- **Keyboard Shortcuts**: Press `/` or `⌘K` anywhere to jump directly to search. Press `Esc` to dismiss modals.
- **VIP Favoriting**: Star key executive sponsors for 1-click access.

### 5. 📲 Mobile QR & One-Click Contact Export
- **Scannable Mobile QR Code**: Point your phone camera at the screen to instantly save the client contact into your iPhone/Android phonebook.
- **Export `.VCF` (vCard standard)**: Direct import into Apple Contacts, Microsoft Outlook, or Google Contacts.
- **CRM / CSV Export**: One-click download formatted for Salesforce / CRM systems.
- **JSON Backup & Restore**: Snapshot and transfer your vault anytime.

---

## 🚀 Quick Start

Open `index.html` directly in any modern browser:

```bash
# Option 1: Open directly in your browser
open index.html

# Option 2: Run via local web server (Python)
python3 -m http.server 8080
# Then open http://127.0.0.1:8080
```

---

## 📁 Project Structure

```
.
├── index.html        # App Shell & UI Layout (Tailwind CSS, Lucide icons)
├── styles.css        # 3D Card flip engine, metallic textures & animations
├── app.js            # CardVault engine, OCR parser, vCard generator, search logic
├── demo-data.js      # Pre-loaded realistic ATL enterprise client datasets
└── README.md         # Documentation
```
