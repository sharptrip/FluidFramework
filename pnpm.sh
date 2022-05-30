echo "Updating run commands to use pnpm (takes 1-2 mins)"
for file in $(fd package.json --type file); do
    # echo "$file"

    # echo '  npm:      ==> pnpm:'
    sd 'pnpm:' 'npm:' "$file"
    sd 'npm:' 'pnpm:' "$file"
    sd 'yarn:' 'pnpm:' "$file"

    # echo '  npm run   ==> pnpm run'
    sd 'pnpm run ' 'npm run ' "$file"
    sd 'npm run ' 'pnpm run ' "$file"
    sd 'yarn run ' 'pnpm run ' "$file"

    sd 'pnpm:@' 'npm:@' "$file"
    sd 'pnpm:fluid-framework' 'npm:fluid-framework' "$file"

    sd '\-\-typescript-compiler-folder \./node_modules/typescript &&' '&&' "$file"
    sd '\-\-typescript-compiler-folder \.\./\.\./\.\./node_modules/typescript &&' '&&' "$file"

done

#############

echo '  lerna run ==> pnpm -r '
sd 'lerna run ' 'pnpm -r ' "package.json"
sd ' --stream --parallel' ' --workspace-concurrency 8' "package.json"
sd ' --stream' ' --workspace-concurrency 8' "package.json"
sd '"postinstall": ' '"-postinstall": ' "package.json"

# routerlicious
sd 'lerna run ' 'pnpm -r ' "server/routerlicious/package.json"
sd ' --stream --parallel' ' --workspace-concurrency 8' "server/routerlicious/package.json"
sd ' --stream' ' --workspace-concurrency 8' "server/routerlicious/package.json"
sd '"postinstall": ' '"-postinstall": ' "server/routerlicious/package.json"

# git add .
# git commit -m 'Pressurize: Update npm run commands'
