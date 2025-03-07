# Steps to upgrade `requirements.txt` python versions to latest

```bash
# Create the venv, if not already created
mkdir ~/.venv
python -m venv ~/.venv/doc-router
. ~/.venv/bin/activate
pip install -r backend/requirements.txt

# Upgrade all modules
for i in `./backend/list_modules.py`; do pip install --upgrade $i; done

# Get all upgraded module versions
for i in `./backend/list_modules.py`; do pip freeze|grep $i; done

# Save the output in backend/requirements.txt
# Keep in mind legacy-cgi is only available on python 3.13 or newer:
legacy-cgi==2.6.2; python_version >= "3.13"
```