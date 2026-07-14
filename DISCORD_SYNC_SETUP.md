# Discord Sync Setup

This guide connects MinMax's Map tracking to a Supabase database and lets
players sign in with Discord. The map itself remains a static GitHub Pages site.

Only the Supabase project URL and browser publishable key go into the website.
Never place a Discord client secret, Supabase database password, or Supabase
service-role key in this repository.

## 1. Create A Supabase Project

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and sign in.
2. Choose **New project**.
3. Pick an organization, name the project `minmax-map`, choose a region, and
   create a database password. Keep that password somewhere private.
4. Wait for the project to finish provisioning.

## 2. Create The Tracking Tables

1. In the new Supabase project, open **SQL Editor** from the left navigation.
2. Click **New query**.
3. Open `supabase/migrations/20260714_discord_sync.sql` from this repository.
4. Copy its entire contents into the editor and click **Run**.
5. Confirm the query succeeds. It creates the tracking tables and their
   row-level security rules, so each Discord account can only read or change
   its own data.

## 3. Create A Discord Application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, name it `MinMax's Map`, then create it.
3. Open **OAuth2** and copy the **Client ID**.
4. Select **Reset Secret** if needed and copy the **Client Secret** somewhere
   private for the next step. Discord will not show that secret again.
5. Under **Redirects**, add the callback URL shown by Supabase for the Discord
   provider. It is normally:

   ```text
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```

   Replace `YOUR-PROJECT-REF` with the first part of your Supabase project URL.
   The exact callback shown in Supabase takes priority if it differs.

## 4. Enable Discord In Supabase

1. Back in Supabase, open **Authentication** and then **Sign In / Providers**.
2. Choose **Discord** and enable the provider.
3. Paste the Discord **Client ID** and **Client Secret** from the Discord
   Developer Portal.
4. Save the provider settings.

The client secret stays inside Supabase. Do not add it to `app-config.js`, a
GitHub secret, or any frontend file.

## 5. Allow The Map URLs

1. In Supabase, open **Authentication** then **URL Configuration**.
2. Set **Site URL** to your current public map URL. Use one of these, depending
   on what is live:

   ```text
   https://minmax.aniimo.io/
   https://donneeee.github.io/Min-Max-s-Interactive-Map/
   ```

3. Under **Redirect URLs**, add both of these patterns so sign-in returns to the
   map on either address:

   ```text
   https://minmax.aniimo.io/**
   https://donneeee.github.io/Min-Max-s-Interactive-Map/**
   ```

Use the GitHub Pages URL until the custom domain is working. A mismatch in this
section is the most common reason Discord sign-in sends an error.

## 6. Add The Safe Browser Configuration

1. In Supabase, open **Project Settings** then **API**.
2. Copy the **Project URL**.
3. Copy the **Publishable key**. If the dashboard only shows an **anon public**
   key, use that instead.
4. Edit `app-config.js` in this repository:

   ```js
   window.MINMAX_MAP_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
     supabasePublishableKey: "YOUR-PUBLISHABLE-OR-ANON-KEY",
   };
   ```

5. Commit and push only this file. Those two values are designed for a browser
   client; the database policies from step 2 protect private tracking rows.

Do not replace the key with a `service_role` key. That key bypasses database
security and must never be exposed on GitHub Pages.

## 7. Verify It Works

1. Open the deployed map and choose **Settings**. The page will show the same
   **Open setup guide** action until the browser configuration is filled in.
2. Choose the Discord sign-in action and authorize the application.
3. Return to **Map**, select a verified respawning overworld collectible such
   as Chroma Ore, and choose **Add to Tracking**.
4. Open **Tracking** and start its timer. The ready time is shown in the
   visitor's own local time.
5. Sign in with the same Discord account on a second device to confirm the
   same tracker appears there.

## Common Problems

### Discord says the redirect URL is invalid

Check both places: the Discord application's redirect must be the Supabase
callback URL, and Supabase's redirect allow list must include the public map
URL pattern.

### The map says tracking needs setup

`app-config.js` is still blank, contains a typo, or the deployed page is using
an older cached file. Confirm the Project URL and publishable key, push the
change, then reload the site once.

### Supabase says a tracking table is missing

Run `supabase/migrations/20260714_discord_sync.sql` in the SQL Editor for the
same Supabase project whose URL is in `app-config.js`.

### I am worried that the browser key is public

That is expected. The project URL and publishable/anon key identify the client;
the row-level security rules enforce that signed-in users can only access rows
where `user_id` matches their own account.
