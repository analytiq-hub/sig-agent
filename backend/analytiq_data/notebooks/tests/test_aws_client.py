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
