#!/bin/sh

while getopts u:e: flag
do
    case "${flag}" in
        u) GITHUB_USER_NAME=${OPTARG};;
        e) GITHUB_USER_EMAIL=${OPTARG};;
    esac
done

set -e

sh -c "git config --global user.name '${GITHUB_USER_NAME}' \
      && git config --global user.email '${GITHUB_USER_EMAIL}' \
      && git add CI/config.json && git commit -m '[skip ci] Update CI config with newely created Qlik app IDs' --allow-empty \
      && git push -u origin HEAD"