"""AWS Lambda entry point. Wraps the existing FastAPI app (yoga_pose_engine.py)
with Mangum so it can run inside a Lambda container image, unchanged --
local/Docker/Render deployments still invoke yoga_pose_engine:app directly via
uvicorn and never import this module.
"""

from mangum import Mangum

from yoga_pose_engine import app

handler = Mangum(app)
