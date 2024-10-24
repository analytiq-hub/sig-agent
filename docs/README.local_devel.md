# Local development environment

## Linux Fedora
* MongoDB setup
  * [Install MongoDB](https://medium.com/@nkav2447/how-to-download-and-install-mongodb-on-fedora-40-2db148a7c2f0)
  * Create `dev` database
* Create a `backend/analytiq-data/.env` file with the following:
  ```bash
  MONGODB_URI=mongodb://localhost:27017
  ENV=dev
  JWT_SECRET="xxx" # Must be a random string
  ```
  * For production, point MONGODB_URI to your MongoDB server, and set ENV to `prod`.
* Create `venv` for doc-router, install `backend/requirements.txt`
  * During setup
  ```bash
  mkdir ~/.venv
  python -m venv ~/.venv/doc-router
  . ~/.venv/doc-router/bin/activate
  pip install -r source/requirements.txt
  ```
  * When running: `. ~/.venv/doc-router/bin/activate`

* Start the back end
  ```bash
  cd backend/app
  uvicorn main:app --host 0.0.0.0 --port 8000
  ```
  * To test in Swagger UI, open [http://localhost:8000/docs], authenticate with a user token, and execute any API calls.
* Open [http://localhost:8000/docs](http://localhost:8000/docs) to experiment with the FastAPI
* Install `NodeJS` and `npm`
* Install the frontend
  ```bash
  cd frontend
  npm install
  ```
* Set up the `frontend/.env.local` file as follows:
  ```bash
  NEXTAUTH_URL=http://localhost:3000
  NEXT_PUBLIC_API_URL=http://localhost:8000
  MONGODB_URI="mongodb://localhost:27017/dev" # Must be same as in backend/analytiq-data/.env, but with the database name attached
  NEXTAUTH_SECRET="xxx" # Must be a random string
  AUTH_GITHUB_ID="xxx" # Create a GitHub OAuth app and put the client ID here
  AUTH_GITHUB_SECRET="xxx" # Create a GitHub OAuth app and put the client secret here
  AUTH_GOOGLE_ID="xxx" # Create a Google OAuth app and put the client ID here
  AUTH_GOOGLE_SECRET="xxx" # Create a Google OAuth app and put the client secret here
  JWT_SECRET="xxx" # Must be same as in backend/analytiq-data/.env
  ```
* Start the front end
  ```bash
  cd frontend
  npm run dev
  ```

## Macbook
Under construction.
