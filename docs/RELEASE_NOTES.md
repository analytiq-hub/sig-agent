# Releases

## v3.1.0

* Fixed [ANALYTIQ-3](https://github.com/analytiq-hub/doc-router/issues/3)

## v3.0.0

* Added OCR and LLM support.
* GUI displays the extracted text.

Known limitations:
* [ANALYTIQ-4](https://github.com/analytiq-hub/doc-router/issues/4) Only Google login is supported.
* [ANALYTIQ-3](https://github.com/analytiq-hub/doc-router/issues/3) Starting with new database gives AWS key error when creating the analytiq_client. Can be worked around by manually adding the AWS keys to MongoDB.

Desired features:
* Non-Google login support.
* Logging support.
* Ability to configure prompts and build workflows.

# Demo tags
* demo1.0.0 - Nov 28 demo, matches v3.0.0 features