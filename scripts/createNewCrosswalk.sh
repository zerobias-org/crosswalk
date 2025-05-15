#! /bin/sh

set -x 

if [ $# -lt 3 ]; then
    echo "Usage: $0 <vendor> <suite> <version>"
    exit 1
fi

BASE_DIR=$(dirname $0)
VENDOR=$1
SUITE=$2
VERSION=$3
EDITED_VERSION=$(echo $VERSION | sed "s/\./_/g")
CODE="$1\_$2\_$3"
FOLDER_PATH="$BASE_DIR/../package/$VENDOR/$SUITE/$EDITED_VERSION"

if [ ! -d "$FOLDER_PATH" ]; then
  echo "Creating folder $FOLDER_PATH."
  mkdir -p $FOLDER_PATH
fi

cp -r $BASE_DIR/../templates/* $FOLDER_PATH
cp  $BASE_DIR/../.npmrc $FOLDER_PATH

# Detect OS and set sed options
if [[ "$(uname)" == "Darwin" ]]; then
  SED_INPLACE_ARG=(-i '')
else
  SED_INPLACE_ARG=(-i)
fi

# Update package.json placeholders
sed "${SED_INPLACE_ARG[@]}" "s/{vendor}/$VENDOR/g" "$FOLDER_PATH/package.json"
sed "${SED_INPLACE_ARG[@]}" "s/{suite}/$SUITE/g" "$FOLDER_PATH/package.json"
sed "${SED_INPLACE_ARG[@]}" "s/{version}/$EDITED_VERSION/g" "$FOLDER_PATH/package.json"

# Generate UUID
UUID=$(uuidgen)

# Update index.yml placeholders
sed "${SED_INPLACE_ARG[@]}" "s/{id}/$UUID/g" "$FOLDER_PATH/index.yml"
sed "${SED_INPLACE_ARG[@]}" "s/{category}/$CATEGORY/g" "$FOLDER_PATH/index.yml"
sed "${SED_INPLACE_ARG[@]}" "s/{code}/$CODE/g" "$FOLDER_PATH/index.yml"
sed "${SED_INPLACE_ARG[@]}" "s/{version}/$VERSION/g" "$FOLDER_PATH/index.yml"