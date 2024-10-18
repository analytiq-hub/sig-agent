# Doc-Router (Under Construction)

We implement a Smart Document Router. When completed, the router will use LLMs to route documents to the appropriate handlers, and to process the documents according to configured workflows.

Tech stack:
* NextJS, NextAuth, MaterialUI, TailwindCSS
  * Future:
* FastAPI
* MongoDB
* Pydantic
* Future: OpenAI, Anthropic, LLama3...

Example display of Smart Document Router docs:
![Smart Document Router](./assets/file_list.png)

![Under Construction](./assets/website_under_construction.jpg)

# Project Slides
[Smart Document Router Slides](https://docs.google.com/presentation/d/10NPy_kRrVfhWHY-No1GAEeNSAr0C-DCpZL2whSzZH9c/edit#slide=id.g302dd857fb2_0_30)

# Local development environment

## Linux Fedora
* MongoDB setup
  * [Install MongoDB](https://medium.com/@nkav2447/how-to-download-and-install-mongodb-on-fedora-40-2db148a7c2f0)
  * Create `dev` database
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
* Start the front end
  ```bash
  cd frontend
  npm run dev
  ```

## Macbook
Under construction.
