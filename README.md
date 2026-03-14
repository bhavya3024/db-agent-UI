This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

Create a `.env.local` file with the following values:

```bash
MONGODB_URI=<your-mongodb-uri>
NEXTAUTH_SECRET=<your-nextauth-secret>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
LANGGRAPH_API_URL=http://localhost:8123
LANGGRAPH_GRAPH_NAME=agent

# 1Password SDK
OP_SERVICE_ACCOUNT_TOKEN=<your-1password-service-account-token>
OP_VAULT_ID=<vault-id-to-store-db-credentials>
```

Database passwords and connection strings are stored in 1Password using the official JavaScript SDK (`@1password/sdk`).

## Migrate Existing Plaintext Credentials

If you have existing connection records with plaintext `password` or `connectionString` fields, run:

```bash
pnpm migrate:secrets:dry
pnpm migrate:secrets
```

The migration creates 1Password items, stores secret reference metadata on each connection document, and removes legacy plaintext credential fields.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
