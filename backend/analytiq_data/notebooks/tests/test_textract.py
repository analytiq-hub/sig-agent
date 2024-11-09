# %%
try:
    get_ipython().run_line_magic('load_ext', 'autoreload')
    get_ipython().run_line_magic('autoreload', '2')
except:
    # Not running in IPython/Jupyter
    pass

# %%
import sys
sys.path.append("../../..")

import analytiq_data as ad

# %%
analytiq_client = ad.common.get_analytiq_client(env="dev")
aws_client = ad.aws.get_aws_client(analytiq_client)

# %%
doc_name = "DetailedBillMay2024.pdf"
file = ad.common.get_file(analytiq_client, doc_name)
if file is None:
    raise HTTPException(status_code=404, detail="File not found")
# %%
blob = file["blob"]
ad.log.info(f"blob size: {len(blob)}")
ad.log.info(f"blob: {blob[:100]}")
# %%
response = ad.aws.textract.run_textract(aws_client, blob)
ad.log.info(f"response: {response}")
# %%
