# Local development environment

## Linux
* MongoDB setup
  * [Install MongoDB](https://medium.com/@nkav2447/how-to-download-and-install-mongodb-on-fedora-40-2db148a7c2f0)
  * Create a `dev` database
* Create a `backend/analytiq-data/.env` file, taking [.env.example](../backend/analytiq_data/.env.example) as a template
  * For production, point MONGODB_URI to your production MongoDB server, and set ENV to `prod`.
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
* Set up the `frontend/.env.local` file, taking [.env.example](../frontend/.env.example) as a template
* Start the front end
  ```bash
  cd frontend
  npm run dev
  ```

## Macbook
Under construction.
