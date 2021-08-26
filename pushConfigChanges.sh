#!/bin/sh
set -e

sh -c "git config --global user.name 'gitoqlik-CI' \
      && git config --global user.email 'gitoqlik-CI@example.com' \
      && git add CI/config.json && git commit -m 'Update CI config with newely created Qlik app IDs' --allow-empty \
      && git push -u origin HEAD"