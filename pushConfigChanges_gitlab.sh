#!/bin/sh

while getopts u:e:t:r:b: flag
do
    case "${flag}" in
        u) GITLAB_USER_NAME=${OPTARG};;
        e) GITLAB_USER_EMAIL=${OPTARG};;
        t) CI_GIT_TOKEN=${OPTARG};;
        r) CI_REPOSITORY_URL=${OPTARG};;
        b) CI_DEFAULT_BRANCH=${OPTARG};;
    esac
done

set -e

sh -c "git config --global user.name '${GITLAB_USER_NAME}' \
      && git config --global user.email '${GITLAB_USER_EMAIL}' \
      && git add CI/config.json && git commit -m '[skip ci] Update CI config with newely created Qlik app IDs' --allow-empty \
      && git push https://${GITLAB_USER_NAME}:${CI_GIT_TOKEN}@${CI_REPOSITORY_URL#*@} HEAD:${CI_DEFAULT_BRANCH}"
