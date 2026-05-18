# TriVanta — Upload to Hostinger (Simple Guide)

> **No technical knowledge needed.** Follow these steps exactly, in order.

---

## What you need before starting
- Your Hostinger login (email + password)
- The file: `trivanta-deploy-LATEST.zip` (in this same folder)
- Your domain already added to Hostinger

---

## STEP 1 — Upload the zip file

1. Go to [hpanel.hostinger.com](https://hpanel.hostinger.com) and log in
2. Click **Websites** → click your domain name
3. Click **Files** in the left menu → **File Manager**
4. Navigate into the `public_html` folder
5. Click **New Folder**, name it `trivanta`, click **Create**
6. Open the `trivanta` folder
7. Click **Upload** (top toolbar) → choose `trivanta-deploy-LATEST.zip`
8. Wait for the upload bar to finish
9. Right-click the zip file → **Extract** → extract into the current folder (`/public_html/trivanta/`)
10. You should now see folders: `client/`, `server/`, and files like `startup.sh`

---

## STEP 2 — Enable Node.js

1. Go back to hPanel → **Websites** → your domain → **Advanced**
2. Find **Node.js** → click **Enable** (or **Manage**)
3. Fill in:
   - **Node.js version:** `20.x` (choose from dropdown)
   - **Application root:** `/public_html/trivanta`
   - **Application startup file:** `server/src/index.js`
4. Click **Save**

---

## STEP 3 — Set your secret settings (Environment Variables)

Still in the Node.js panel, find **Environment Variables** and add these one by one:

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_EXPIRES_IN` | `7d` |
| `DB_PATH` | `/home/YOUR_HOSTINGER_USERNAME/public_html/trivanta/trivanta.db` |
| `CLIENT_URL` | `https://yourdomain.com` |
| `UPLOAD_DIR` | `/home/YOUR_HOSTINGER_USERNAME/public_html/trivanta/uploads` |
| `MAX_FILE_SIZE_MB` | `20` |
| `JWT_SECRET` | *(see Step 4 below to generate this)* |

> **Replace `YOUR_HOSTINGER_USERNAME`** with your actual username.  
> Find it in hPanel → SSH Access (shown as `u123456789` or similar).

> **Replace `yourdomain.com`** with your actual domain.

---

## STEP 4 — Generate your secret key (JWT_SECRET)

1. In hPanel → **Advanced → SSH Terminal** → click **Open Terminal**
2. Type this exactly and press Enter:
   ```
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Copy the long string of numbers and letters that appears
4. Go back to Environment Variables → add:
   - Name: `JWT_SECRET`
   - Value: (paste the string you copied)
5. Click **Save**

---

## STEP 5 — Install & start the app

Still in the SSH Terminal:

```bash
cd ~/public_html/trivanta
bash startup.sh
```

This will take about 1-2 minutes. It installs the software and creates demo accounts.

When it finishes you'll see:
```
✅ Setup complete!
```

---

## STEP 6 — Start the app

Back in hPanel → **Node.js** panel → click **Restart**

Then open your browser and go to `https://yourdomain.com` — you should see the TriVanta homepage!

---

## Demo accounts (for testing)

| Role | Email | Password |
|------|-------|----------|
| Managing Partner | partner@trivanta.com | Password123! |
| Attorney | attorney@trivanta.com | Password123! |
| Client | client@trivanta.com | Password123! |

---

## Something went wrong?

**App not loading (502 error):**
- Wait 60 seconds and refresh — Node.js takes a moment to start
- Check hPanel → Node.js → make sure it shows **Running**

**Forgot to run startup.sh:**
```bash
cd ~/public_html/trivanta
bash startup.sh
```

**Need to reset everything:**
```bash
cd ~/public_html/trivanta
rm -f trivanta.db
bash startup.sh
```

**More detailed help:** See `HOSTINGER_DEPLOY.md` in the same folder.

---

*TriVanta v1.0 — Deployment package built automatically*
