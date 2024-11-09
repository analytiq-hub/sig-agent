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
response = aws_client.s3.list_objects_v2(Bucket='analytiq-data')
for obj in response.get('Contents', []):
    print(obj['Key'])
# %%