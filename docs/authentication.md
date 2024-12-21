# Authentication Support

* On initial install, the admin user is created from the following environment variables:
  * `ADMIN_EMAIL`
  * `ADMIN_PASSWORD`
  * See the example `.env` files for more details
* We support Google OAuth2.0 and GitHub OAuth2.0, as well as email/password authentication
  * As of 12/21/2024, we do not support email registration verification, but this is on the roadmap
* We use NextAuth.js 4.22.0 as the authentication library
* We use MongoDB as the backend database
  * Users are stored in the `users` collection
  * OAuth session tokens are stored in the `accounts` collection
  * To reset state, delete the `users` and `accounts` collections

# FAQ

* How do I deal with a `OAuthAccountNotLinked` Error with OAuth providers?
  * This occurs when the same email was used to log in through a different OAuth provider, or through email/password authentication.
  * To resolve, log in through the old provider, and delete the user through our settings page.
* If the error persists:
  * An older version of the code was inconsistenly saving OAuth information to the database. As of version 6.0.2, this is fixed.
  * To further resolve this, ask the admin to delete the user/account records in the `users` and `accounts` collections. Then, re-authenticate with the OAuth provider.
