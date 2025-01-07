# Smart Document Router

The Smart Document Router is an open source Document Understanding and Data Extraction tool. It is like [LLamaCloud](https://docs.llamaindex.ai), but for Enterprises using ERP systems.
* It ingests unstructured docs from faxes, email, and ERPs.
* It selects streams of docs that can be processed autonomously with LLMs and NLP - reducing the need for time-consuming, expensive manual workflows.

The Document Router is designed with a human-in-the-loop and can processes financial data correctly ‘on the nose’. (We are not doing RAG!)

Tech stack:
* NextJS, NextAuth, MaterialUI, TailwindCSS
  * Future:
* FastAPI
* MongoDB
* Pydantic
* Future: OpenAI, Anthropic, LLama3...

Example display of Smart Document Router docs:
![Smart Document Router](./assets/file_list.png)

# Project Slides
[Smart Document Router Slides](https://docs.google.com/presentation/d/10NPy_kRrVfhWHY-No1GAEeNSAr0C-DCpZL2whSzZH9c/edit#slide=id.g302dd857fb2_0_30)

# Docs
* [Local development environment](./docs/README.local_devel.md)
* [Docker setup](./docs/README.docker.md)
