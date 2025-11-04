#!/usr/bin/env bash

rsync -avz -L --exclude=.* \
  $(pwd) root@138.201.85.101:/home/hoota/

ssh root@138.201.85.101 'docker stop browserless && docker rm browserless'
ssh root@138.201.85.101 'cd /home/hoota/browserless.git && docker build -f docker/patched/Dockerfile -t ft-browserless .'
ssh root@138.201.85.101 'docker run   -d   --name browserless   --restart=always   -p 57555:3000   -e "CONCURRENT=10"   -e "TOKEN=52c392b7-52b6-4516-9eb0-481b0f008a7a"   ft-browserless'
