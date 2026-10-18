# P4-1: Local Kubernetes

Design only. Detect installed kind/minikube contexts without changing the active kubectl context. Show local clusters, pod readiness and port-forwards in a separate section. Keep remote contexts out until remote-host permissions are designed.

Use explicit context and namespace arguments for every bounded request. Reading pods needs a separate opt-in because cluster metadata may be private. Readiness, disconnected, unavailable, access-denied and stale-data states must be distinct. Never put kubeconfig credentials into IPC or diagnostics.

Pod restart/delete and port-forward launch require a captured cluster/context/namespace/UID snapshot, an exact confirmation, and fresh identity verification. Never reuse process-stop privileges to mutate Kubernetes resources. Begin with read-only inventory and fixtures; gate mutations on a local disposable kind cluster and wrong-context tests. No Kubernetes implementation is included in this change.
