# Zendy Delivery AI - Setup Guide

This guide provides comprehensive setup instructions for deploying and configuring the Zendy Delivery AI system.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Supabase Configuration](#supabase-configuration)
4. [Evolution API Setup](#evolution-api-setup)
5. [OpenAI Configuration](#openai-configuration)
6. [Database Setup](#database-setup)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up Zendy, ensure you have:

- **Node.js** v18+ and npm installed
- A **Supabase** account (free tier available)
- An **Evolution API** instance (for WhatsApp integration)
- An **OpenAI API** key
- Basic knowledge of PostgreSQL and REST APIs

---

## Environment Variables

### Frontend (.env)

Create a `.env` file in the project root with these variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Backend (Supabase Secrets)

These secrets are configured in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
# Supabase Secrets (managed via Supabase Dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Evolution API Configuration
EVOLUTION_API_URL=https://your-evolution-api.com
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE_NAME=your-instance-name

# OpenAI Configuration
OPENAI_API_KEY=sk-...your-openai-key

# Lovable Configuration (if applicable)
LOVABLE_API_KEY=your-lovable-api-key
```

---

## Supabase Configuration

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization, name, database password, and region
4. Wait for project to be provisioned

### 2. Run Database Migrations

All migrations are in `supabase/migrations/`. Apply them via:

**Option A: Supabase CLI**
```bash
supabase db push
```

**Option B: Supabase Dashboard**
1. Go to SQL Editor
2. Copy contents of each migration file
3. Run them in order

### 3. Configure Storage

Create the following storage bucket:

- **Bucket Name**: `product-images`
- **Public**: Yes
- **File Size Limit**: 5MB
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`

**RLS Policies for `product-images`:**

```sql
-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Allow authenticated uploads
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated updates
CREATE POLICY "Authenticated update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated deletes
CREATE POLICY "Authenticated delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );
```

### 4. Set Supabase Secrets

In Supabase Dashboard → Settings → Edge Functions → Secrets, add all the backend environment variables listed above.

---

## Evolution API Setup

Evolution API is required for WhatsApp Business integration.

### 1. Deploy Evolution API

**Option A: Docker (Recommended)**

```bash
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=your-api-key \
  -e DATABASE_ENABLED=true \
  -e DATABASE_CONNECTION_URI=mongodb://mongo:27017/evolution \
  atendai/evolution-api:latest
```

**Option B: Hosted Service**

Use a managed Evolution API provider (check Evolution API documentation for providers).

### 2. Create WhatsApp Instance

1. Access Evolution API at `http://your-api-url`
2. Create instance using POST `/instance/create`:

```json
{
  "instanceName": "your-instance-name",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS"
}
```

3. Configure webhook URL in Evolution API settings:
   - URL: `https://your-project.supabase.co/functions/v1/whatsapp-webhook`
   - Events: `messages.upsert`, `connection.update`

### 3. Connect WhatsApp

1. Open Zendy Dashboard → WhatsApp Connection
2. Click "Criar / Conectar Instância"
3. Scan QR code with WhatsApp Business app
4. Wait for "Conectado" status

---

## OpenAI Configuration

### 1. Get OpenAI API Key

1. Visit [platform.openai.com](https://platform.openai.com)
2. Create account or sign in
3. Go to API Keys section
4. Create new secret key
5. Copy and save securely

### 2. Configure in Supabase

Add `OPENAI_API_KEY` to Supabase Edge Functions secrets.

### 3. Model Selection

Default models used:
- **Orchestrator Agent**: `gpt-4o-mini`
- **Conversational Agent**: `gpt-4o-mini`

To change models, update the `agents` table via SQL Editor or AI Configuration page.

---

## Database Setup

### Key Tables

The system uses these core tables:

- **restaurants**: Restaurant information and settings
- **categories**: Menu categories
- **products**: Menu items with prices and images
- **addons**: Product add-ons/extras
- **customers**: Customer profiles
- **carts**: Shopping cart sessions
- **cart_items**: Items in carts
- **orders**: Completed orders
- **messages**: WhatsApp message history
- **conversation_state**: AI conversation tracking
- **agents**: AI agent configurations
- **agent_prompt_blocks**: AI prompt templates
- **agent_tools**: AI agent tool configurations

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- Users can only access their own restaurant's data
- Authentication required for all write operations
- Public read access for product images only

---

## Deployment

### Frontend Deployment

**Using Lovable (Recommended):**

1. Click "Publish" button in Lovable editor
2. Follow prompts to deploy
3. Custom domain can be configured in Settings

**Manual Deployment:**

```bash
npm run build
# Deploy dist/ folder to Vercel, Netlify, etc.
```

### Edge Functions Deployment

Edge functions deploy automatically when code is pushed to Supabase:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy whatsapp-ai-agent
```

---

## Troubleshooting

### WhatsApp Connection Issues

**Problem**: Status shows "Desconectado" even after scanning QR

**Solution**:
1. Check Evolution API logs
2. Verify webhook URL is correct
3. Ensure `EVOLUTION_INSTANCE_NAME` matches
4. Re-scan QR code

---

**Problem**: QR code doesn't appear

**Solution**:
1. Check Evolution API is running
2. Verify API key is correct
3. Check browser console for errors
4. Try clicking "Criar / Conectar Instância" again

---

### Database Connection Issues

**Problem**: "Failed to fetch restaurant"

**Solution**:
1. Check Supabase project is active
2. Verify `VITE_SUPABASE_URL` and keys are correct
3. Check if restaurant record exists in database
4. Run onboarding flow to create restaurant

---

### AI Agent Not Responding

**Problem**: Messages received but no AI response

**Solution**:
1. Check OpenAI API key is valid and has credits
2. View Edge Function logs: Supabase Dashboard → Edge Functions → whatsapp-ai-agent
3. Verify restaurant `is_open` is `true`
4. Check agent is active in `agents` table

---

### Image Upload Failures

**Problem**: Product images fail to upload

**Solution**:
1. Check file size (max 5MB)
2. Verify file type (JPEG, PNG, WebP only)
3. Check storage bucket `product-images` exists
4. Verify RLS policies allow authenticated uploads

---

## Support

For additional help:

- Check project documentation: `README.md`, `PROJECT_STRUCTURE.md`
- Review edge function logs in Supabase Dashboard
- Check browser console for frontend errors
- Review database logs in Supabase Dashboard → Database → Logs

---

## Security Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Rotate API keys
- [ ] Review and test RLS policies
- [ ] Enable MFA on Supabase account
- [ ] Set up monitoring and alerts
- [ ] Configure CORS properly for production domain
- [ ] Review and limit Edge Function permissions
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Review AI agent prompts for security

---

**Last Updated**: 2025-01-19  
**Version**: 1.0.0
