<div align="center">

# 📒 NoteBank — BRACU

**Course notes, slides, videos, books and past questions, shared by BRAC University students for BRAC University students.**

Organised by **course**, **faculty** and **semester**, so you always study from the right material.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-2338A8)

<!-- After deploying on Render, replace the link below with your own -->
**[🌐 Live demo](https://bracu-notebank.onrender.com)** · **[🎬 How to use (video)](#-how-to-use)** · **[🚀 Run it yourself](#-run-it-on-your-computer)**

Created by **UMMA SALMA MIM**

<img src="docs/screenshots/welcome.png" alt="NoteBank welcome page with Nobi, the notebook mascot" width="900">

</div>

---

## 💡 Why NoteBank?

Every semester, BRACU students hunt for the same things: last semester's slides, a senior's notes, solved past questions, a good YouTube explanation, all scattered across Messenger groups and Google Drive links that expire.

Materials also depend on **who teaches the course**. Notes from one faculty's CSE110 section may not match another's.

NoteBank puts everything in one place and tags each resource with the **course code, course name, faculty name, faculty initials and semester**. Juniors can find exactly what was used in their own section.

## ✨ Features

| | |
|---|---|
| 👋 **Welcome page** | First-time visitors meet **Nobi**, an animated notebook mascot who waves, blinks and asks which course you need. Tap Nobi for a surprise. |
| 🔎 **Search** | Search by course code (`CSE110`), faculty initials (`ARF`) or any topic (`recursion`). |
| 🎛️ **Filters** | Filter by course, faculty, semester and resource type. Sort by newest, most helpful, most downloaded or latest semester. |
| 📤 **Share resources** | Upload PDFs, slides, docs, images, code, ZIP or video (up to 50 MB), or share a YouTube or Google Drive link. |
| ▶️ **Video embeds** | YouTube links play directly on the resource page. |
| 👍 **Helpful votes & comments** | Students mark what helped and leave tips, like "covers chapters 1–4, great for the mid". |
| 📚 **Courses & faculty directory** | Every course and faculty member, with how many resources each has. |
| ⚡ **Smart autocomplete** | Course codes and faculty initials that already exist autocomplete and fill in the full names, so the same course isn't spelled five ways. |
| 🎓 **BRACU-only accounts** | Sign-up is limited to `@g.bracu.ac.bd` emails (configurable). Browsing is open to everyone. |
| 🛡️ **Moderation** | Uploaders can delete their own posts, and admins can remove anything. |
| 📱 **Phone & dark mode** | Works on any screen size and follows your device's dark mode. |

## 📸 Screenshots

| Browse & filter | Resource page |
|---|---|
| <img src="docs/screenshots/browse.png" alt="Browse page with search and filters" width="440"> | <img src="docs/screenshots/resource.png" alt="Resource page with download, helpful votes and comments" width="440"> |

| Share a resource | Phone (dark mode) |
|---|---|
| <img src="docs/screenshots/upload.png" alt="Upload form with course, faculty and semester fields" width="440"> | <img src="docs/screenshots/mobile-dark.png" alt="Welcome page on a phone in dark mode" width="220"> |

## 🎬 How to use

<!-- Edit this README on GitHub and drag NoteBank-how-to-use.mp4 here to embed the walkthrough video -->

1. **Browse** the home page. No account is needed to look around.
2. **Search** for your course code or your faculty's initials, or tap a popular course.
3. **Filter** by faculty, semester or type, and sort by **Most helpful**.
4. **Open** a resource to download it, open its link or watch its video.
5. **Sign up** with your BRACU email to vote and comment.
6. **Share** your own material with **Share a resource**: add the course, faculty and semester, attach a file or link, and publish.
7. Find everything you've shared under **your name → My uploads**.

## 🛠️ Built with

| Part | Technology |
|---|---|
| Server | Node.js + Express 5 |
| Database | JSON file (`data/db.json`), no setup needed |
| File uploads | Multer, stored in `uploads/` |
| Login | Passwords hashed with bcrypt, sessions in a secure httpOnly cookie (JWT) |
| Frontend | Plain HTML, CSS and JavaScript, no build step |
| Fonts | Bricolage Grotesque and Atkinson Hyperlegible |

## 🚀 Run it on your computer

**You need:** [Node.js](https://nodejs.org) version 18 or newer.

```bash
# 1. Download the code
git clone https://github.com/ummasalmamim/BRACU_NoteBank.git
cd BRACU_NoteBank

# 2. Install
npm install

# 3. Create your settings file
cp .env.example .env          # Windows: copy .env.example .env

# 4. (Optional) Add sample data to look around
npm run seed

# 5. Start
npm start
```

Open **http://localhost:3000** in your browser.

After `npm run seed`, you can sign in with the demo account **`demo@g.bracu.ac.bd`** / **`demo12345`**.

> **Tip:** Don't open `public/index.html` by double-clicking it. The site needs the server running (`npm start`).

## ⚙️ Settings (`.env`)

| Setting | What it does | Default |
|---|---|---|
| `PORT` | Port the website runs on | `3000` |
| `JWT_SECRET` | Secret key for logins. **Change this to a long random string before going live.** | dev-only value |
| `ALLOWED_EMAIL_DOMAIN` | Only allow sign-ups with this email domain. Leave empty to allow any email. | `g.bracu.ac.bd` |
| `ADMIN_EMAILS` | Comma-separated emails that can delete any upload or comment | empty |
| `MAX_UPLOAD_MB` | Largest file allowed, in MB | `50` |
| `STORAGE_DIR` | Folder for the database and uploads. Point it at a persistent disk when hosting. | project folder |
| `NODE_ENV` | Set to `production` when deployed over HTTPS | `development` |

## 🌐 Deploy on Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. Click **New + → Web Service** and choose this repository.
3. Use these settings:
   - **Build command:** `npm install`
   - **Start command:** `npm run seed && npm start`
   - **Instance type:** Free
4. Add environment variables: `NODE_ENV=production` and a long random `JWT_SECRET`.
5. Click **Deploy**. Your site will be live at `https://<your-name>.onrender.com`.

> **Free plan limits:** the site sleeps after 15 minutes without visitors and takes about a minute to wake up. Files and data are wiped when it restarts, so the free plan works as a **demo** (the seed step restores the sample data). To keep real students' uploads, use a paid instance with a persistent disk mounted at `/var/data` and set `STORAGE_DIR=/var/data`.

## 📁 Project structure

```
BRACU_NoteBank/
├── server.js                  Starts the app
├── package.json
├── .env.example               Settings template
├── src/
│   ├── config.js              Reads settings
│   ├── db.js                  JSON-file database
│   ├── auth.js                Login cookies and rate limiting
│   ├── validate.js            Rules for course codes, initials, semesters, file types
│   └── routes/
│       ├── auth.js            Sign up, sign in, sign out
│       ├── resources.js       Search, upload, download, votes, comments
│       └── meta.js            Course, faculty and semester lists
├── public/                    The website
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── favicon.svg
├── scripts/seed.js            Sample data
├── data/                      Database file is saved here
├── uploads/                   Uploaded files are saved here
└── docs/screenshots/          Images used in this README
```

## 🔌 API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account `{ name, email, password, department? }` |
| `POST` | `/api/auth/login` | Sign in `{ email, password }` |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/resources` | List and search. Query: `q`, `course`, `faculty`, `semester`, `type`, `sort`, `page`, `mine=1` |
| `GET` | `/api/resources/:id` | One resource |
| `POST` | `/api/resources` | Upload (multipart form, optional `file`) |
| `DELETE` | `/api/resources/:id` | Delete (uploader or admin) |
| `POST` | `/api/resources/:id/vote` | Toggle "Helpful" |
| `GET` | `/api/resources/:id/file` | Download (`?inline=1` to view PDFs, images and video in the browser) |
| `GET` / `POST` | `/api/resources/:id/comments` | List or add comments |
| `DELETE` | `/api/resources/:id/comments/:commentId` | Delete a comment (author or admin) |
| `GET` | `/api/meta` | Courses, faculty, semesters, types and stats |

## 🗺️ Roadmap

- [ ] Email verification for new accounts
- [ ] "Report" button for wrong or copyrighted files
- [ ] Section filter (e.g. CSE110 Section 05)
- [ ] Move to MongoDB or PostgreSQL with cloud file storage
- [ ] Bangla language option

## 🤝 Contributing

Ideas and improvements are welcome:

1. Fork this repository.
2. Create a branch: `git checkout -b my-feature`.
3. Commit your changes and open a pull request.

## ⚠️ Share responsibly

NoteBank is a student project and **not an official BRAC University service**. Share only material you're allowed to share. Faculty slides and textbooks may be copyrighted, so linking to the official source is safer than re-uploading. **Never share exam questions before the exam has taken place.**

## 👩‍💻 Author

**UMMA SALMA MIM**
Student, BRAC University
GitHub: [@ummasalmamim](https://github.com/ummasalmamim)

If NoteBank helped you, give the repo a ⭐ and share it with your classmates!

## 📄 License

This project is licensed under the [MIT License](LICENSE).
