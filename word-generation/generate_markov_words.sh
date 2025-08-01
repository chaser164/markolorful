#!/bin/bash

# Array of input files
input_files=(
    "input/aesop.txt"
    "input/amendments.txt"
    "input/as-you-like-it.txt"
    "input/beatles.txt"
    "input/bible.txt"
    "input/dream.txt"
    "input/hello-world.txt"
    "input/IolantheLibretto.txt"
    "input/monalisa.txt"
    "input/opening-exercises.txt"
    "input/pearl_jam.txt"
    "input/taylor-swift.txt"
    "input/trump-clinton1.txt"
    "input/trump-clinton2.txt"
    "input/trump-clinton3.txt"
    "input/wiki_100k.txt"
)

# Output file
output_file="markov_words_output.txt"

# Clear the output file
> "$output_file"

echo "Generating markov chain words..."

# Run 10 times
for i in {1..10}; do
    echo "Run $i/10"
    
    # Select a random input file
    random_index=$((RANDOM % ${#input_files[@]}))
    selected_file="${input_files[$random_index]}"
    
    echo "  Using file: $selected_file"
    
    # Run markov.py and capture output
    markov_output=$(python3 markov.py 1 "$selected_file")
    
    # Filter words: split by spaces, filter by length (5-14 chars), randomly select 10
    # Use sort -R for random shuffling (macOS compatible)
    filtered_words=$(echo "$markov_output" | tr ' ' '\n' | grep -E '^.{5,14}$' | sort -R | head -10)
    
    # Count how many words we actually got
    word_count=$(echo "$filtered_words" | wc -l)
    echo "  Selected $word_count words from this run"
    
    # Append to output file
    echo "$filtered_words" >> "$output_file"
    
    # Add a separator for readability (optional)
    echo "" >> "$output_file"
done

# Count total words in output
total_words=$(grep -v '^$' "$output_file" | wc -l)
echo "Complete! Generated $total_words words total and saved to $output_file" 