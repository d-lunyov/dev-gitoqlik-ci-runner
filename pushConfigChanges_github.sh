#!/bin/sh

while getopts GITHUB_USER_NAME:GITHUB_USER_EMAIL: flag
do
    case "${flag}" in
        GITHUB_USER_NAME) GITHUB_USER_NAME=${OPTARG};;
        GITHUB_USER_EMAIL) GITHUB_USER_EMAIL=${OPTARG};;
    esac
done

set -e

sh -c "
      echo 'Using user.name ${GITHUB_USER_NAME}' \
      && echo 'Using user.email ${GITHUB_USER_EMAIL}' \
      && git config --global user.name '${GITHUB_USER_NAME}' \
      && git config --global user.email '${GITHUB_USER_EMAIL}' \
      && git add CI/config.json && git commit -m '[skip ci] Update CI config with newely created Qlik app IDs' --allow-empty \
      && git push -u origin HEAD"