# 👗 GIRL STORE - POS System Technical & Functional Documentation
## الشرح الشامل لبرنامج ومكونات نظام "بنت ستور" (GIRL STORE)

Bienvenue dans la documentation officielle du système de gestion de point de vente (POS) pour **GIRL STORE**. Ce document détaille l'explication de l'application, son infrastructure (architecture), ainsi que les langages et technologies utilisés pour sa création.

---

## 🗺️ Index / الفهرس
1. [🇲🇦 Darija: Chareh meta3 l-App (شرح مفصل للبرنامج)](#-darija-chareh-meta3-l-app-شرح-مفصل-للبرنامج)
2. [📐 Architecture & Binya Tahtiya (البنية التحتية للمشروع)](#-architecture--binya-tahtiya-البنية-التحتية-للمشروع)
3. [💻 Languages & Tech Stack (اللغات والتقنيات المستعملة)](#-languages--tech-stack-اللغات-والتقنيات-المستعملة)
4. [📂 Directory Tree & Key Files (هيكلة الملفات الأساسية)](#-directory-tree--key-files-هيكلة-الملفات-الأساسية)

---

## 🇲🇦 Darija: Chareh meta3 l-App (شرح مفصل للبرنامج)

Had l-app dyal **GIRL STORE** hia nizam integrated (POS - Point of Sale) dyal tssyir l-maby3at w l-makhzoun khass b dukan dyal pajamas w sleepwear. Kat7iyed l-khdma dyal l-werqa w l-stilo w katssehel l-muraqaba.

### 🌟 Key Features (Aham l-khasa'iss):
1. **POS Dashboard (لوحة المبيعات)**:
   - Fin kadiro l-checkout dyal l-klyen tqdar tsscaner bar-code aw katchouf tsawer dyal l-pijamat direct.
   - Fiha system dyal l-kocher (Cashier) w search sahla b smiya aw barcode.
   - system dyal l-cart, katzid quantities, kadih discount (takhfid), w kat7sseb l-baqi (change calculation).

2. **Catalog Management (تسيير السلع والمخزون)**:
   - tqdar t-charger tsawer dyal pijama, t-editer t-prix dyal l-bi3 (retail price) w prix dyal l-chra (purchase price), l-quantité dyal stock, barcode, sizes, w l-colors.
   - System fih alert automatique ila l-stock dyal chi pijama qreb yssali.

3. **Overhead Expenses (تسيير المصاريف)**:
   - Kat-enregistrer ga3 l-masarif l-kharijia dyal l-ma7al (kray, l-ma, l-khdama, transport, publicite...) b tarikh dyalhom bach t7sseb l-arba7 l-safya exact.

4. **Sales History Ledger (سجل المبيعات)**:
   - System fih register dyal ga3 l-bi3at li dazo, chkoun l-user li ba3hom, t-tarikh dyalhom w l-items exact. Katqdar t-printi l-reçu aw dir delete/cancel l maby3at makhdo'ach.

5. **Reports & Profits (الأرباح والمبيعات بالبريد الإلكتروني)**:
   - Kat7sseb l-arba7 l-yawmya w l-arba7 l-idafya kamla:
     - **Daily Revenue** (مداخيل اليوم)
     - **Daily Net Profit** (الأرباح الصافية لليوم) = (prix dyal l-bi3 - prix dyal l-chra) * l-quantite - l-masarif (expenses) dyal l-yawm.
     - **Cumulative Total Revenue** (مجموع المداخيل الإجمالية).
     - **Cumulative Net Profit** (مجموع الأرباح الصافية الإجمالية).
     - **Best Seller** (المنتج الأكثر مبيعاً بالتفصيل).
   - **📬 Email Delivery Feature**: Tqdar d-dakhel l-email dyalk (f.e. gmail) w l-app tsseyfet lik ga3 l-arba7 w t-taqarir l-yawmya b tarikh direct l-email dyalk (m3a system simulation f-ila makanch 3ndk SMTP).

6. **Users & Role Management (تسيير المستخدمين والصلاحيات)**:
   - Fiha Admin w Cashier (admin 3ndo s-sala7iya ychouf l-arba7 w l-as3ar dyal l-chra w y-modifier stock, Cashier kayqdar ghir ybi3 w ychouf makhzoun).

7. **USB Background Sync (مزامنة بيانات USB)**:
   - L-app fiha automatic detection dyal USB keys flash drives f l-PC, kat-syncki data direct bach t7miha mn l-diya3 (Offline-safe local backup).

---

## 📐 Architecture & Binya Tahtiya (البنية التحتية للمشروع)

Le projet est conçu selon une architecture **Full-Stack moderne (Client-Serveur) monolithique et autonome**, fonctionnant entièrement hors-ligne (ou en ligne pour les emails).

```
   ┌──────────────────────────────────────────────────────────┐
   │                  CLIENT / FRONTEND                       │
   │      React 18 + Vite + Tailwind CSS + Framer Motion      │
   └──────────────────────────┬───────────────────────────────┘
                              │
                    HTTP Requests (API)
                              │
   ┌──────────────────────────▼───────────────────────────┐
   │                  SERVER / BACKEND                    │
   │               Node.js + Express (TypeScript)         │
   └──────────────────────────┬───────────────────────────┘
                              │
                    JSON Database Engine
                              │
   ┌──────────────────────────▼───────────────────────────┐
   │               LOCAL DATABASE & SYSTEMS               │
   │  - db.json (JSON files for local speed storage)      │
   │  - USB Sync Backup (Local drive integration)          │
   │  - Nodemailer SMTP Mail Engine (Automatic reports)   │
   └──────────────────────────────────────────────────────┘
```

### 1. Le Frontend (Interface Utilisateur)
- **Vite** : Utilisé comme serveur de build ultra-rapide.
- **React 18** : Gère l'état global, les onglets (POS, Stock, Expenses, Sales, Users, Reports), les animations d'affichage et l'affichage fluide.
- **Tailwind CSS v4** : Gère le design de l'application en mode sombre (Dark Theme luxueux, couleur de base `#161616` et accents indigo, émeraude, rose).
- **Framer Motion** : Gère les transitions fluides des onglets, l'affichage des modals de confirmation (comme la boîte de dialogue de déconnexion) et le panier d'achat.
- **Lucide React** : Fournit tous les icônes vectoriels de l'interface utilisateur.

### 2. Le Backend (Serveur API)
- **Express.js (Node.js)** : Un serveur web robuste écrit en **TypeScript** (`server.ts`).
- **Middleware Vite** : Intégré en développement pour compiler le code TypeScript de React en temps réel sans nécessiter de rafraîchissement manuel lourd.
- **Nodemailer** : Utilisé pour se connecter aux serveurs SMTP (comme Gmail, Outlook, ou serveurs pro) afin d'expédier les rapports financiers quotidiens directement dans la boîte mail configurée de l'administrateur.

### 3. Base de données localisée (Local Database)
- **dbJson.ts** : Un moteur de base de données ultra-rapide basé sur un fichier JSON (`db.json`) localisé dans le projet. Il implémente des verrous d'écriture et de lecture pour éviter la corruption de fichiers, tout en gardant l'application complètement autonome sans exiger l'installation d'un moteur SQL externe lourd.
- **USB Sync Mode** : Détecte dynamiquement la présence de clés USB sous Windows et effectue une sauvegarde instantanée du fichier `db.json` sur le lecteur amovible pour la sécurité des données de l'utilisateur.

---

## 💻 Languages & Tech Stack (اللغات والتقنيات المستعملة)

Le système GIRL STORE POS est propulsé par les technologies de pointe de l'écosystème JavaScript/TypeScript :

| Technologie / Langage | Rôle dans l'application | Description |
| :--- | :--- | :--- |
| **TypeScript (TS)** | Langage principal (Back & Front) | Sécurise le code grâce au typage fort, prévient les erreurs de développement et structure les données financières (`Sale`, `Product`, `Expense`, `User`). |
| **Node.js** | Environnement d'exécution | Permet de faire tourner le serveur web `server.ts` localement sur n'importe quel ordinateur Windows/Mac/Linux. |
| **JavaScript (JS/ES6)** | Langage de script | Utilisé dans le processus d'assemblage (bundling), les fichiers de configuration de Vite, et les scripts d'initialisation. |
| **HTML5 & CSS3** | Structure & Design | Mise en page structurée, respectant l'accessibilité numérique et les contrastes visuels. |
| **Tailwind CSS** | Framework de style | Permet d'écrire du style directement dans le HTML avec des classes utilitaires, garantissant une réactivité mobile et PC impeccable. |
| **Nodemailer (Mail Engine)** | Moteur d'envoi d'e-mails | Bibliothèque Node.js permettant de se connecter de manière sécurisée en SSL/TLS aux serveurs de messagerie électronique. |
| **VBScript (Visual Basic)** | Automatisation Windows | Le fichier `start_pos.vbs` permet de lancer l'application d'un simple double-clic sur le bureau de l'utilisateur, en démarrant Node.js silencieusement en tâche de fond. |

---

## 📂 Directory Tree & Key Files (هيكلة الملفات الأساسية)

Voici l'organisation interne des fichiers de l'application :

```
GIRL_STORE_POS/
├── server.ts              # Serveur Backend principal (Express, API, SMTP mailer)
├── db.json                # Fichier Base de Données local (S'auto-génère)
├── .env.example           # Modèle de configuration pour le serveur de mail SMTP
├── start_pos.vbs          # Script de démarrage silencieux Windows double-clic
├── package.json           # Déclaration des dépendances (React, Express, Nodemailer, TypeScript)
├── tsconfig.json          # Configuration des règles de compilation TypeScript
├── vite.config.ts         # Configuration du bundler Vite pour le Frontend React
├── index.html             # Point d'ancrage HTML principal
│
├── src/                   # Répertoire principal du Code Source
│   ├── main.tsx           # Point d'entrée React
│   ├── index.css          # Styles globaux Tailwind CSS
│   ├── types.ts           # Définition des interfaces TypeScript de l'application
│   ├── dbJson.ts          # Moteur d'accès et d'écriture de db.json
│   │
│   ├── components/        # Dossier des modules de composants d'onglets
│   │   ├── POSCheckoutTab.tsx  # Écran principal de vente (Panier, Scan, Paiement)
│   │   ├── ProductsTab.tsx     # Gestion du catalogue (Pijamas, Tailles, Couleurs, Alertes)
│   │   ├── SalesTab.tsx        # Journal d'historique de vente et impressions de reçus
│   │   ├── ExpensesTab.tsx     # Enregistrement des charges et sorties de caisse
│   │   ├── ReportsTab.tsx      # Calculateur d'arba7, graphiques SVG et expéditeur de rapports par Mail
│   │   └── AdminUsersTab.tsx   # Gestion des accès, rôles et mots de passe
│   │
│   └── App.tsx            # Coeur de l'application (Navigation globale, Sync USB, Déconnexion)
```

---

## 🔒 Configuration du Serveur d'E-mail (SMTP)
Pour que l'application puisse expédier de réels e-mails à votre adresse, renseignez les variables suivantes dans votre panneau de configuration d'environnement ou fichier `.env` :

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="votre-email@gmail.com"
SMTP_PASS="votre-mot-de-passe-d-application-gmail"
SMTP_FROM='"Girl Store Reports" <votre-email@gmail.com>'
```

*Remarque : Si ces informations ne sont pas définies, le système bascule automatiquement en **Mode Simulation**, vous affichant directement un aperçu visuel du mail généré sur votre écran dans l'onglet des rapports.*

---
**Développé avec excellence pour GIRL STORE - 2026**
