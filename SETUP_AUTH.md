# Setting Up Jira Authentication

Since your organization uses SSO, you need to create a Jira API token for authentication.

## Step 1: Create a Jira API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name (e.g., "Sprint Tracker")
4. Click **"Create"**
5. **Copy the token** (you won't be able to see it again!)

## Step 2: Create a `.env` File

Create a file named `.env` in your project root with:

```bash
JIRA_EMAIL=your-email@tekion.com
JIRA_API_TOKEN=your-api-token-here
```

Replace:
- `your-email@tekion.com` with your Tekion email
- `your-api-token-here` with the token you just created

## Step 3: Restart the Server

```bash
# Kill the current server (if running)
# Then start it again
node server.js
```

The server will automatically pick up your credentials from the `.env` file.

## Step 4: Try Adding Filter Again

Now the authentication should work!

## Security Notes

⚠️ **Important:**
- Never commit the `.env` file to git (it's already in `.gitignore`)
- Keep your API token secure
- Don't share it with anyone

## Troubleshooting

**Still getting 404?**
- Verify the filter ID is correct
- Make sure you have access to the filter in Jira
- Check that the filter isn't private to someone else

**401 Unauthorized?**
- Double-check your email and API token
- Make sure there are no extra spaces in the `.env` file
