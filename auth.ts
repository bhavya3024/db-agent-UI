import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth config without MongoDB adapter for Edge Runtime compatibility
// The adapter is only needed for database sessions, but we use JWT
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Return true if authenticated
      return !!auth;
    },
    jwt: async ({ token, account, profile }) => {
      // On initial sign in, add the user ID from Google's sub claim
      if (account && profile) {
        token.id = profile.sub; // Google's unique user identifier
      }
      // Fallback: use email if sub is not available
      if (!token.id && token.email) {
        token.id = token.email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.id as string) || token.email || "";
      }
      return session;
    },
  },
});
