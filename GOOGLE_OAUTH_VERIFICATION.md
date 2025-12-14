# Fixing "Access Blocked" - Google OAuth Verification

## The Issue

When you try to connect to Google Drive, you see:
> "Access blocked: This app's request is invalid"
>
> "The developer hasn't given you access to this app"
>
> "This app has not been verified yet by Google"

This happens because Google restricts unverified apps from accessing user data.

## Solution 1: Add Test Users (Recommended for Personal Use)

This is the **easiest solution** if you're using the app yourself or with a small team (up to 100 test users).

### Steps:

1. **Go to Google Cloud Console**
   - Navigate to [console.cloud.google.com](https://console.cloud.google.com)
   - Select your project

2. **Open OAuth Consent Screen**
   - In the left sidebar: **APIs & Services** → **OAuth consent screen**

3. **Add Test Users**
   - Scroll down to the **"Test users"** section
   - Click **"+ ADD USERS"**
   - Enter your Gmail address (the one you want to use with the app)
   - Add any other users who need access
   - Click **"Save"**

4. **Publishing Status**
   - Your app should show as **"Testing"** status
   - This is perfect for personal use!

5. **Try Connecting Again**
   - Go back to your Job Estimator app
   - Settings → Google Drive
   - Click "Connect to Google Drive"
   - You should now be able to authorize!

### Important Notes:
- ✅ Test users can use the app immediately
- ✅ No verification needed
- ✅ Up to 100 test users allowed
- ✅ Perfect for personal/team use
- ⚠️ The app will show a warning "This app isn't verified" - click "Advanced" → "Go to [App Name] (unsafe)" to proceed
- ⚠️ Only works for the email addresses you add as test users

---

## Solution 2: App Verification (For Public Apps)

Only needed if you want **anyone** to use your app (not just specific users).

### When You Need This:
- Publishing the app for public use
- Want to remove the "unverified app" warning
- Need more than 100 users

### Verification Process:

1. **Complete OAuth Consent Screen**
   - Fill out all required fields
   - Add app logo (120x120px)
   - Add privacy policy URL
   - Add terms of service URL
   - Add app homepage URL

2. **Prepare for Review**
   - Create a YouTube video showing your app in action
   - Explain what data you access and why
   - Show the user experience

3. **Submit for Verification**
   - In OAuth consent screen, click **"PUBLISH APP"**
   - Click **"Prepare for verification"**
   - Follow the verification form
   - Submit required documentation

4. **Wait for Review**
   - Google review takes 3-6 weeks
   - They may ask for additional information
   - Once approved, the warning disappears

### Verification Requirements:
- ✅ Valid domain ownership
- ✅ Privacy policy
- ✅ Terms of service
- ✅ Demo video
- ✅ Detailed scope justification
- ⏰ 3-6 week review time
- 💰 May require payment for verification

---

## Solution 3: Use Internal User Type (Google Workspace Only)

If you have a Google Workspace account:

1. **Change User Type to Internal**
   - OAuth consent screen → User Type: **Internal**
   - This limits access to your organization only
   - No verification needed
   - No test user limit

2. **Requirements**:
   - Must have Google Workspace account (paid)
   - Only users in your organization can access
   - Not suitable for personal Gmail accounts

---

## Recommended Approach

### For Personal Use:
**Use Solution 1: Test Users**
- Add yourself as a test user
- Click through the "unverified app" warning
- Works immediately, no waiting

### For Small Team (< 100 people):
**Use Solution 1: Test Users**
- Add all team members as test users
- Share the "click Advanced → Continue" instructions
- Free and instant

### For Public App:
**Use Solution 2: Verification**
- Complete the full verification process
- Takes 3-6 weeks but removes all warnings
- Required for public distribution

---

## Accepting the "Unverified App" Warning

When using test users, you'll still see a warning. Here's how to proceed:

1. Click **"Connect to Google Drive"** in your app
2. Google shows: **"Google hasn't verified this app"**
3. Click **"Advanced"** (bottom left)
4. Click **"Go to [Your App Name] (unsafe)"**
5. Review permissions and click **"Allow"**
6. You're connected! ✅

This is **safe** because:
- You created the app
- You control the code
- The app only accesses files it creates (`drive.file` scope)
- Your credentials stay in your browser

---

## Troubleshooting

### "This app is blocked"
- **Cause**: No test users added
- **Fix**: Add your email as test user (Solution 1, Step 3)

### "The developer hasn't given you access"
- **Cause**: You're not listed as a test user
- **Fix**: Add your email in OAuth consent screen

### "Invalid redirect URI"
- **Cause**: Your app URL doesn't match authorized redirect URIs
- **Fix**: In Credentials, add your exact URL to "Authorized redirect URIs"
- Example: `https://yourusername.github.io/job_estimator/`

### "Access denied"
- **Cause**: You clicked "Cancel" or "Deny" on the consent screen
- **Fix**: Try connecting again and click "Allow"

### "Invalid Client ID"
- **Cause**: Wrong Client ID entered in settings
- **Fix**: Copy Client ID again from Google Cloud Console → Credentials

---

## Security Notes

### Is it safe to click "Go to unsafe app"?

**Yes, if you created the app!**

The warning appears because Google hasn't reviewed your app, not because it's actually dangerous. Since you:
- Wrote the code yourself
- Control what data is accessed
- Only request minimal permissions (`drive.file`)
- Store credentials locally

...it's perfectly safe to proceed.

### What permissions does the app request?

The app only requests:
```
https://www.googleapis.com/auth/drive.file
```

This scope means:
- ✅ App can create new files in Drive
- ✅ App can access files it created
- ❌ App CANNOT access your other Drive files
- ❌ App CANNOT read your emails
- ❌ App CANNOT access other Google services

This is the most restrictive Drive scope available!

---

## FAQ

**Q: Do I need to verify my app for personal use?**
A: No! Just add yourself as a test user.

**Q: How many test users can I add?**
A: Up to 100 users.

**Q: Does the "unverified app" warning go away?**
A: Only after completing full Google verification (Solution 2).

**Q: Can I use the app without verification?**
A: Yes! Test users can use it indefinitely.

**Q: How long does verification take?**
A: 3-6 weeks, sometimes longer.

**Q: Does verification cost money?**
A: The verification process is free, but you may need to pay for related services (domain, privacy policy hosting, etc.).

**Q: Can I switch from test users to verified later?**
A: Yes! You can start with test users and verify later if needed.

---

## Quick Start Checklist

For personal use, follow these steps:

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com)
- [ ] Select your project
- [ ] Navigate to: APIs & Services → OAuth consent screen
- [ ] Scroll to "Test users" section
- [ ] Click "+ ADD USERS"
- [ ] Enter your Gmail address
- [ ] Click "Save"
- [ ] Return to your Job Estimator app
- [ ] Settings → Google Drive → Connect to Google Drive
- [ ] When you see "Google hasn't verified this app":
  - [ ] Click "Advanced"
  - [ ] Click "Go to [App Name] (unsafe)"
  - [ ] Review permissions
  - [ ] Click "Allow"
- [ ] Start uploading photos! 🎉

---

## Additional Resources

- [Google OAuth Verification Guide](https://support.google.com/cloud/answer/9110914)
- [OAuth Consent Screen Documentation](https://support.google.com/cloud/answer/10311615)
- [API Scopes Documentation](https://developers.google.com/identity/protocols/oauth2/scopes)

---

## Still Having Issues?

If you've followed these steps and still can't connect:

1. **Check OAuth consent screen status**
   - Should show "Testing" (not "In production")
   - Should have at least one test user

2. **Verify redirect URIs**
   - Must match your app's exact URL
   - Include trailing slash if your URL has one

3. **Clear browser cache**
   - Google caches consent decisions
   - Try in an incognito window

4. **Check Client ID**
   - Copy it fresh from Google Cloud Console
   - Paste into Settings → Google Drive

5. **Review browser console**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Look for specific error messages
