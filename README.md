[![Build Status](https://travis-ci.org/codecovevienna/gittt-cli.svg?branch=master)](https://travis-ci.org/codecovevienna/gittt-cli)
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
$ gittt commit 3 -m "Spent a great time with this code"
```

6. After committing more hours or editing already committed hours the data can be pushed to your time tracking repository by executing
```
$ gittt push
```

## Releases

The binary releases can be found under the [Releases Tab](https://github.com/codecovevienna/gittt-cli/releases)

## Contribute

Every help is appreciated, take a look at the [Contributing file](https://github.com/codecovevienna/gittt-cli/blob/master/CONTRIBUTING.md)