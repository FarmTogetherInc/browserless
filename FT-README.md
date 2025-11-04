## How to build
You need to have SSH root access to 138.201.85.101 (Hetzner server).
If you have it, run locally:
```shell
./sync.sh
```
this will sync files to server and run docker build there.

## Run
```shell
# login to the server
ssh root@138.201.85.101

# run on the server:
docker run -d --name browserless \
  --restart=always \
  -p 57555:3000  \
  -e "CONCURRENT=10" \
  -e "TOKEN=52c392b7-52b6-4516-9eb0-481b0f008a7a" \
  ft-browserless
```
