# Kubernetes manifests

Local orchestration demo for the pose-analysis API. Tested against Minikube; no
cloud-specific configuration.

## Run it

```bash
minikube start

# Build the image inside Minikube's Docker daemon so no registry is needed
eval $(minikube docker-env)          # PowerShell: & minikube docker-env | Invoke-Expression
docker build -t yoga-pose-engine:local backend/

kubectl apply -f backend/k8s/
kubectl rollout status deployment/yoga-pose-engine

# Reachable URL (LoadBalancer is emulated by Minikube)
minikube service yoga-pose-engine --url
curl "$(minikube service yoga-pose-engine --url)/health"
```

Tear down with `kubectl delete -f backend/k8s/`.

## Notes on the choices

**Port 7860** matches `EXPOSE`/`CMD` in the Dockerfile (chosen originally for
Hugging Face Spaces). The Service publishes port 80 and targets the container
port by name, so changing the container port only requires editing the
Deployment.

**One replica.** Two pieces of state live in the process: the loaded models and
the live-mode stability filter's per-session vote history
(`_session_predictions`). With more than one replica, a phone's frames would
round-robin across pods and each would see roughly a third of the window, so
the 3-of-5 majority would rarely be reached and poses would stop being
reported. Scaling out needs session affinity
(`service.spec.sessionAffinity: ClientIP`) or that history moved into Redis.

**Startup probe.** Importing TensorFlow and allocating the TFLite interpreter
takes noticeably longer than a normal web process starts. The startup probe
gives it up to 150s before the liveness probe is allowed to begin, which stops
a slow cold boot from being restart-looped.

**Probe honesty.** `/health` deliberately does not force a model load, so
`Ready` here means "the process is serving and its model artifacts are on
disk", not "the first inference will be fast". For a stricter gate, add an
endpoint that touches `get_classifier()` and point `readinessProbe` at it —
readiness would then lag by one model load.

**Resources.** The requests reflect idle footprint; the 2Gi limit is headroom
for TensorFlow during inference. Confirm against your own workload with
`kubectl top pod` before treating these as anything but a starting point.
