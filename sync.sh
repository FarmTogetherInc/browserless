#!/usr/bin/env bash

rsync -avz -L --exclude=.* \
  $(pwd) root@138.201.85.101:/home/hoota/

ssh root@138.201.85.101 'cd /home/hoota/browserless.git && docker build -f docker/patched/Dockerfile -t ft-browserless .'
