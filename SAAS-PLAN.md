# SaaS Architecture Plan

## 🏗️ Repository Strategy

### ✅ Recommended: Separate Repositories

```
dead-links-must-die/           # This repo (OSS core)
├── Core crawler engine
├── Link checker logic
├── CLI tool
└── API endpoints

dead-links-saas/               # Private repo (SaaS features)
├── Authentication (Clerk)
├── Database (Supabase)
├── Email (Resend)
├── Payment (Stripe)
├── Scheduled scans
├── User dashboard
└── Marketing site
```

### Why Separate Repos?

**✅ Advantages:**
- Clear separation: OSS vs proprietary
- Different access controls (public vs private)
- Easier to maintain separate deployment pipelines
- Can dogfood OSS library in SaaS product
- Community can use core without SaaS complexity

**❌ Monorepo would mean:**
- Need to carefully .gitignore SaaS parts
- Risk of accidentally exposing proprietary code
- More complex CI/CD setup
- Harder to accept community contributions

---

## 📦 What Goes Where

### OSS Repo (`dead-links-must-die`) - Current Repo
- ✅ Core crawler (`crawler.js`, `smart-crawler.js`, `sitemap-crawler.js`)
- ✅ Link checker (`checker.js`)
- ✅ CLI tool (future: `npx dead-links-must-die <url>`)
- ✅ Basic web UI (public folder)
- ✅ API server (`server.js`)
- ✅ Documentation, tests, examples
- ✅ Docker setup for self-hosting

### SaaS Repo (`dead-links-saas`) - To Be Created
- 🔐 User authentication (Clerk)
- 🔐 Database schema (Supabase)
- 🔐 Scheduled scans (cron jobs)
- 🔐 Email notifications (Resend)
- 🔐 Payment processing (Stripe)
- 🔐 User dashboard UI
- 🔐 Marketing website
- 🔐 API rate limiting
- 🔐 Analytics & tracking

---

## 🎯 SaaS MVP Features

### Free Tier
- ✅ Scan up to 100 pages per site
- ✅ Manual scans only (no scheduling)
- ✅ View results in browser
- ✅ Export as JSON
- ❌ No email notifications
- ❌ No scan history (results expire after 24h)
- ❌ No API access

### Pro Tier ($19/month)
- ✅ Scan up to 10,000 pages per site
- ✅ Scheduled scans (daily/weekly/monthly)
- ✅ Email notifications when broken links found
- ✅ 30-day scan history
- ✅ Export as CSV/JSON
- ✅ API access (100 scans/month)
- ✅ Priority support

### Enterprise (Contact Us)
- ✅ Unlimited pages
- ✅ Custom scan schedules
- ✅ Webhook notifications
- ✅ Team collaboration
- ✅ SSO/SAML
- ✅ SLA guarantee
- ✅ Dedicated support

---

## 🛠️ Tech Stack for SaaS

### Frontend
```
Next.js 14 (App Router)
├── Tailwind CSS
├── shadcn/ui components
├── React Query
└── Chart.js (for analytics)
```

### Backend
```
Next.js API Routes + Serverless Functions
├── Railway (Node.js backend)
└── Vercel Edge Functions (for fast API)
```

### Authentication
```
Clerk
├── Email/password
├── Google OAuth
├── GitHub OAuth
└── Magic links
```

### Database
```
Supabase (Postgres)
├── users table
├── scans table
├── scan_results table
├── subscriptions table
└── api_keys table
```

### Email
```
Resend
├── Welcome emails
├── Broken link notifications
├── Weekly summaries
└── Billing emails
```

### Payments
```
Stripe
├── Subscriptions
├── Usage-based billing
├── Customer portal
└── Webhooks
```

### Hosting
```
Vercel (Frontend + API)
├── Auto-deploy from main
├── Preview deployments
└── Edge functions

Railway (Background Jobs)
├── Scheduled scans
├── Long-running crawls
└── Webhook dispatcher
```

---

## 🗄️ Database Schema

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free', -- free, pro, enterprise
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### sites
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  schedule TEXT, -- null, 'daily', 'weekly', 'monthly'
  notify_email BOOLEAN DEFAULT false,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);
```

### scans
```sql
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  pages_found INTEGER DEFAULT 0,
  links_checked INTEGER DEFAULT 0,
  broken_links_count INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  error_message TEXT,
  results JSONB, -- Full scan results
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_site_id ON scans(site_id);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
```

### api_keys
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL, -- bcrypt hash
  name TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL, -- pro, enterprise
  status TEXT NOT NULL, -- active, canceled, past_due
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚀 Implementation Phases

### Phase 1: MVP Foundation (Week 1-2)
- [ ] Create `dead-links-saas` private repo
- [ ] Set up Next.js 14 project
- [ ] Integrate Clerk authentication
- [ ] Set up Supabase database
- [ ] Deploy basic app to Vercel
- [ ] Connect to OSS library via npm (publish to npm)

### Phase 2: Core Features (Week 3-4)
- [ ] User dashboard (scan history)
- [ ] Manual scan UI (using OSS core)
- [ ] Free tier limits (100 pages)
- [ ] Results storage in Supabase
- [ ] Export as JSON/CSV

### Phase 3: Pro Features (Week 5-6)
- [ ] Stripe integration
- [ ] Pro tier subscription
- [ ] Scheduled scans (Railway cron jobs)
- [ ] Email notifications (Resend)
- [ ] 10,000 page limit for Pro

### Phase 4: Polish & Launch (Week 7-8)
- [ ] Marketing landing page
- [ ] Pricing page
- [ ] Documentation
- [ ] Email templates
- [ ] User onboarding flow
- [ ] Beta launch to 10-20 users

### Phase 5: Post-Launch (Ongoing)
- [ ] API access for Pro users
- [ ] Webhooks
- [ ] Team collaboration
- [ ] Enterprise features
- [ ] Analytics dashboard

---

## 💰 Cost Breakdown (Zero Until Paid Users)

### Free (Development)
- ✅ Vercel: Free tier (hobby plan)
- ✅ Supabase: Free tier (500MB database)
- ✅ Clerk: Free tier (10,000 MAU)
- ✅ Resend: Free tier (100 emails/day)
- ✅ Stripe: No monthly fee (just % on transactions)

### With Paid Users
- **Vercel Pro**: $20/month (when you need more bandwidth)
- **Supabase Pro**: $25/month (when you exceed 500MB)
- **Railway**: ~$5-20/month (for background jobs)
- **Clerk**: Pay as you grow
- **Resend**: Pay as you grow

**Total startup cost**: $0
**Cost with first paid users**: ~$50-70/month
**Break-even**: ~3-4 Pro users ($19/mo × 4 = $76/mo)

---

## 📁 Folder Structure (SaaS Repo)

```
dead-links-saas/
├── app/                          # Next.js 14 app router
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── page.tsx              # Dashboard home
│   │   ├── scans/
│   │   │   ├── page.tsx          # Scan list
│   │   │   ├── [id]/page.tsx    # Scan details
│   │   │   └── new/page.tsx     # New scan
│   │   ├── sites/
│   │   │   ├── page.tsx          # Site list
│   │   │   └── [id]/page.tsx    # Site details
│   │   └── settings/
│   │       ├── page.tsx          # Account settings
│   │       └── billing/page.tsx # Billing
│   ├── (marketing)/
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/page.tsx     # Pricing
│   │   ├── docs/page.tsx        # Documentation
│   │   └── blog/page.tsx        # Blog
│   └── api/
│       ├── scan/route.ts        # Start scan
│       ├── webhooks/
│       │   ├── stripe/route.ts  # Stripe webhooks
│       │   └── clerk/route.ts   # Clerk webhooks
│       └── cron/
│           └── scheduled/route.ts # Scheduled scans
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── scan/
│   │   ├── ScanList.tsx
│   │   ├── ScanResults.tsx
│   │   └── BrokenLinkTable.tsx
│   └── marketing/
│       ├── Hero.tsx
│       ├── Features.tsx
│       └── Pricing.tsx
├── lib/
│   ├── db/                      # Supabase client
│   ├── clerk/                   # Clerk auth
│   ├── stripe/                  # Stripe client
│   ├── email/                   # Resend client
│   └── scanner/                 # OSS library wrapper
├── supabase/
│   ├── migrations/              # Database migrations
│   └── seed.sql                 # Seed data
├── public/
│   ├── images/
│   └── fonts/
├── .env.local.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

---

## 🔗 Connecting OSS to SaaS

### Option 1: Publish OSS as npm Package
```bash
# In dead-links-must-die repo
npm publish

# In dead-links-saas repo
npm install dead-links-must-die

# Use in code
import { smartCrawl, checkLinks } from 'dead-links-must-die';
```

### Option 2: Git Submodule (Not Recommended)
```bash
git submodule add https://github.com/shyamvalsan/dead-links-must-die.git core
```

### ✅ Recommended: Option 1 (npm package)
- Easier to version
- Can use in multiple projects
- Community can also use it
- Cleaner dependency management

---

## 🎯 Next Steps

1. **Finish OSS Polish** (This week)
   - Add CLI tool (`npx dead-links-must-die <url>`)
   - Improve documentation
   - Add more examples

2. **Publish to npm** (Next week)
   - `npm publish dead-links-must-die`
   - Test installation from npm

3. **Create SaaS Repo** (Week after)
   - Initialize Next.js 14 project
   - Set up Clerk + Supabase
   - Deploy to Vercel
   - Build MVP

4. **Beta Launch** (1 month)
   - Get 10-20 beta users
   - Iterate on feedback
   - Add Stripe payments

5. **Public Launch** (2 months)
   - Marketing push
   - Product Hunt
   - Hacker News
   - Twitter launch

---

## 📝 Notes

- Keep OSS core simple and focused
- All "convenience" features go in SaaS (scheduling, notifications, etc.)
- SaaS wraps OSS core + adds value layer
- Community builds on OSS, pays for convenience
- Clear value proposition: "Free to self-host, pay for convenience"

---

**Questions?** Add them to this document or discuss in issues.
