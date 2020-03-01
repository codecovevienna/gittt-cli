#/usr/bin/env bash

# https://iridakos.com/programming/2018/03/01/bash-programmable-completion-tutorial

_gittt_completions()
{
  if [ "${#COMP_WORDS[@]}" != "2" ]; then
    return
  fi

  COMPREPLY=($(compgen -W "commit add push info list today report setup start stop init link publish edit remove import export" "${COMP_WORDS[1]}"))
}

complete -F _gittt_completions gittt
