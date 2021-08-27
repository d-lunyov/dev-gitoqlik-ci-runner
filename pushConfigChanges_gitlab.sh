#!/bin/sh

while getopts GITLAB_USER_NAME:GITLAB_USER_EMAIL:CI_GIT_TOKEN:CI_REPOSITORY_URL:CI_DEFAULT_BRANCH: flag
do
    case "${flag}" in
        GITLAB_USER_NAME) GITLAB_USER_NAME=${OPTARG};;
        GITLAB_USER_EMAIL) GITLAB_USER_EMAIL=${OPTARG};;
        CI_GIT_TOKEN) CI_GIT_TOKEN=${OPTARG};;
        CI_REPOSITORY_URL) CI_REPOSITORY_URL=${OPTARG};;
        CI_DEFAULT_BRANCH) CI_DEFAULT_BRANCH=${OPTARG};;
    esac
done

set -e

sh -c "git config --global user.name '${GITLAB_USER_NAME}' \
      && git config --global user.email '${GITLAB_USER_EMAIL}' \
      && git add CI/config.json && git commit -m '[skip ci] Update CI config with newely created Qlik app IDs' --allow-empty \
      && git push https://${GITLAB_USER_NAME}:${CI_GIT_TOKEN}@${CI_REPOSITORY_URL#*@} ${CI_DEFAULT_BRANCH}"
