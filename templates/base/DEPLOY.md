# Deploy on your own account

Read SETUP.md first and run this download's verifier. Use accounts that you own for GitHub, hosting, Supabase, and optional email. APL never receives your production credentials. An editor preview uses sample behavior; your configured deployment uses real data.

Before uploading, keep the repository private: project.apl.json and initial-content seeds contain your unpublished content. The supplied .gitignore excludes environment files, dependencies and build output.

## Recommended first path: Render web service

1. Create your own GitHub repository and upload the source, including package-lock.json. Exclude .env.local, node_modules, and .next.
2. Create your own Supabase project and complete SETUP.md if backend modules are selected.
3. In your Render account, create a Node Web Service connected to your repository. A Static Site cannot run the backend.
4. Build command: npm ci && npm run build. Start command: npm start. Select Node.js 24 (or set NODE_VERSION to 24). Keep Render's PORT value; Next.js reads it and binds to 0.0.0.0 through the supplied start script.
5. Enter the environment variables in Render's secret settings. Set SITE_URL to the exact HTTPS address of the deployed website. Public Supabase variables must exist during build; rebuild when they change.
6. Deploy. Test the public page, form submission, administrator login, and every selected admin module. For CMS, save a private draft, verify its URL is hidden, Publish, and verify both text and image.
7. Add your domain in the hosting dashboard. Copy the displayed DNS records into your domain provider. Verify ownership and wait for HTTPS issuance.
8. Update SITE_URL and Supabase redirect settings to the final address and repeat the smoke tests.

Expected result: every authored page opens over HTTPS; /admin accepts only the administrator you created; a real contact inquiry appears in the inbox; CMS drafts remain private until Publish. Check your selected modules only. If login or content reports missing setup, check the environment variable names, SQL migration order, and your owner-controlled Supabase project before changing source.

Render free services sleep after inactivity. Use a suitable paid service for dependable business operation.
Official guide: https://render.com/docs/deploy-nextjs-app
Free limits: https://render.com/docs/free
Domain guide: https://render.com/docs/custom-domains

## Alternative: Vercel

Import your own GitHub repository into your Vercel account. Choose Next.js and configure the same environment variables. Use external Supabase storage for persistent files. Vercel Hobby is limited to personal/non-commercial use; select an eligible plan for business use. Review function duration and resource limits for any new backend module.

https://vercel.com/docs/plans/hobby

## Alternative: a Node/Docker server

Use the included Dockerfile. Supply public Supabase variables as build arguments and private values as runtime environment variables. Keep the server behind a TLS reverse proxy. The owner maintains security updates, monitoring, backups and HTTPS.

https://nextjs.org/docs/app/guides/self-hosting

## Backups, updates and rollback

Back up Supabase database data and storage objects separately. Keep encrypted copies outside the hosting account and test restoration. Free Supabase projects do not include the same backup services as paid plans.

Re-exporting a design changes source code. It must not reset the production database. Apply only new migrations; keep existing submissions, CMS drafts/publications and administrator identities. The initial content importers only insert missing IDs; they never replace existing records. New content changes after deployment belong in /admin. Review source changes through Git if you have customized the export.

Roll back application code using your host's previous deployment. Database changes need compatible migrations or a tested restore, not just an older deployment.

https://supabase.com/docs/guides/platform/backups

## First deployment checklist

- Keep an untouched copy of the downloaded ZIP and its passing verification report.
- Finish local setup against your own Supabase project; confirm /admin and each selected module.
- Create a private GitHub repository, upload source, and connect it to your hosting account.
- Enter secrets in the hosting dashboard, then deploy and test its temporary HTTPS address.
- Connect your domain using the host's DNS instructions and update SITE_URL.
- Configure your own Brevo sender and Supabase custom SMTP if sending email; test real delivery separately.
- Take database and file backups and record how you will restore them.

This guide has been checked against the official provider documentation. It does not mean a deployment has been performed in your account. Next.js Node and Docker deployments support server features; a static host cannot run the selected full-stack backend. See https://nextjs.org/docs/app/getting-started/deploying.

## Production gate

Before collecting real customer information, arrange independent review of authorization, uploads, form abuse controls, dependency security, secret handling and recovery. This prototype implements global and hashed-email limits, not a complete anti-spam service. Add owner-configured bot protection and trusted-proxy IP controls as part of production hardening.

