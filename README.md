[![Build Status](https://travis-ci.com/codecovevienna/gittt-cli.svg?branch=master)](https://travis-ci.com/codecovevienna/gittt-cli)
[![codecov](https://codecov.io/gh/codecovevienna/gittt-cli/branch/master/graph/badge.svg)](https://codecov.io/gh/codecovevienna/gittt-cli)

# gittt-cli

This project aims to track the time spent on a specific [git](https://git-scm.com/) project and stores it locally and separate git repository. 

## Features

- Use a own git repository as a time tracking server
- Add time records to the past
- Edit committed time records
- Git-like syntax
- Timer
- Publish recorded amount of spent time to third party applications (e.g. [Jira](https://www.atlassian.com/software/jira))


## Using the `.gittt.yml`

1. Create a directory in your workspace which represents the project
```bash
mkdir new_project
```
2. Navigate into the project directory
```bash
cd new_project
```
3. Create a `.gittt.yml` file in a new directory or an existing project directory with the following content
```yaml
name: new_project
```
4. Initialize the new gittt project
```
gittt init
```

## Migrate projects from `.git/config` to `.gittt.yml`

1. Create a `.gittt.yml` file in a new directory or an existing project directory with the following content
```yaml
name: name_of_the_project_to_book_resources_to
```
2. Navigate to the projects directory in your gittt config directory in your home directory
```bash
cd ~/.gittt-cli/projects
```
3. Move the projects file from the project to migrate into the root projects directory
```bash
mv github_com/project_to_migrate.json .
```

4. Open up the json file and remove the meta data object and fix the name
```diff
2,6d1
<     "meta": {
<         "host": "github.com",
<         "port": null,
<         "raw": "git@github.com:eiabea/tempea-api.git"
<     },
>     "name": "name_of_the_project_to_book_resources_to",
```
5. Save the file and you are good to go


## Bash completion

```
cp bash/gittt-completion.bash /etc/bash_completion.d/gittt-completion.bash
source /etc/bash_completion.d/gittt-completion.bash
```

## How to

1. Install binary on your system (tba.)
2. Create an empty private git repository on your favorite git provider (e.g. [github](https://github.com) or [GitLab](https://gitlab.com)) or on your private git server
3. Initialize the gittt working directory by executing
```
$ gittt init
```

4. Change into a local git repository of any awesome project you are currently working on
```
$ cd my-awesome-project
```

5. Commit the spent hours with the following command
```
$ gittt commit -m "Spent a great time with this code" -a 3
```

6. After committing more hours or editing already committed hours the data can be pushed to your time tracking repository by executing
```
$ gittt push
```

## CSV Import to projects

Use the CSV importer option to import a csv file to your project.

The CSV file has to include a header with at least the columns `MESSAGE,END,AMOUNT,TYPE` (any other columns will be ignored)

Hint: The `TYPE` row is mandatory and currently only takes `Time` as a valid input.

```
MESSAGE,END,AMOUNT,TYPE
Added Production Build,1570298400000,0.5,Time
```

The `END` parameter can also be formated in the human readable form `Y-m-d HH:mm:ss` e.g.

```
MESSAGE,END,AMOUNT,TYPE
Added Production Build,2019-10-05 18:00:00,0.5,Time
```

Import data to your current project (aka. The git directory you are currently at) with

```
$ gittt import [path_to_your_file].csv
```

## Releases

The binary releases can be found under the [Releases Tab](https://github.com/codecovevienna/gittt-cli/releases)

## Contribute

Every help is appreciated, take a look at the [Contributing file](https://github.com/codecovevienna/gittt-cli/blob/master/CONTRIBUTING.md)
