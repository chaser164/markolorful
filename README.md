# Markov Chain Text Generation

*Chase Reynders*

## Overview

This is a simple python script that takes in an order value `k` and a `.txt` file and builds a `k`th-order Markov chain generated from the `.txt` input, represented as an adjacency list.

The program then outputs a pseudorandom string derived from the Markov chain.

## Usage

Call the script like so:
`python markov.py <order> <.txt file path>`

## Sources

[This Princeton CS Homework Assignment](https://www.cs.princeton.edu/courses/archive/spring05/cos126/assignments/markov.html) inspired me to do this project.

I downloaded many of the included `.txt` files from [here](https://www.cs.princeton.edu/courses/archive/spr24/cos126/assignments/chat126/).

Taylor Swift corpus from [here](https://github.com/irenetrampoline/taylor-swift-lyrics/blob/master/all_tswift_lyrics.txt).

## TODO

- make it class-based with order as an attribute to work against silly code
- allow for max_tokens and keeping/removing of \n to be specified as CLA
