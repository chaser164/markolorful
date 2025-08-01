import random
import sys

# inputs: file path
# outputs: the contents of the file as a string, all newlines replaced with spaces, or exits with invalid paths
def read_file_as_string(file_path, replace_newline_with_space=False):
    try:
        with open(file_path, 'r') as file:
            file_contents = file.read()
            if replace_newline_with_space:
                file_contents = file_contents.replace('\n', ' ')  # Replace newline characters with spaces
        return file_contents
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        sys.exit(1)

# inputs: string (input text) and chunk_size (number to chunk by)
# outputs: list of chunks of the text, each chunk of size chunk_size, removing [-1] if not size of chunk_size
def split_string_into_chunks(string, chunk_size=1):
    chunks = [string[i:i+chunk_size] for i in range(0, len(string), chunk_size)]
    if len(chunks[-1]) < chunk_size:
        chunks.pop()  # Remove the last chunk if its length is less than chunk_size
    return chunks

# inputs: string (input text)
# outputs: 2D list of all possible divisions into chunks by the above function, offsetting chunk_size timews
def get_all_chunks(string, chunk_size=1):
    all_chunks = []
    for i in range(chunk_size):
        all_chunks.append(split_string_into_chunks(string[i:], chunk_size=chunk_size))
    return all_chunks

# inputs: 2D list of all possible text chunks
# outputs: markov chain represented as an adjacency list
def build_markov_chain(all_chunks):
    adjacency_list = {}
    # Record a starting token
    order = len(all_chunks[0][0])
    unreachable_start_key = '*' * order + 'START' + '*' * order
    adjacency_list[unreachable_start_key] = [all_chunks[0][0]]
    # Populate tokens
    for chunk_sequence in all_chunks:
        for i in range(len(chunk_sequence) - 1):
            # add ith chunk as a token if it's not already there
            if chunk_sequence[i] in adjacency_list:
                # Append (i + 1)th chunk to the adjacency list of the ith chunk
                adjacency_list[chunk_sequence[i]].append(chunk_sequence[i + 1])
            else:
                # Initialize the adjacency list entry for the ith chunk as a list containing the (i + 1)th chunk
                adjacency_list[chunk_sequence[i]] = [chunk_sequence[i + 1]]
            # If the (i + 1)th chunk is not in the adjacency matrix, add it
            if chunk_sequence[i + 1] not in adjacency_list:
                adjacency_list[chunk_sequence[i + 1]] = []
    return adjacency_list

def generate_pseudorandom_output(markov_chain, max_tokens=1000):
    # silly solution, make it class based eventually...
    order = len(list(markov_chain.values())[0][0])
    unreachable_start_key = '*' * order + 'START' + '*' * order
    # Populate output string
    output = ''
    token = markov_chain[unreachable_start_key][0]
    # optional counter logic
    counter = 0
    if not max_tokens:
        max = 10
    else:
        max = max_tokens
    while counter < max:
        output += token
        token_choices = markov_chain[token]
        # Check if we reached an end-sequence token
        if len(token_choices) == 0:
            break
        # set the next token
        token = random.choice(token_choices)
        if max_tokens:
            counter += 1
    return output


def main():
    # Parse input
    if len(sys.argv) != 3:
        print("Usage: python script.py <order> <file_path>")
        return 1

    order_str = sys.argv[1]
    if not order_str.isdigit():
        print("Error: <order> must be a positive integer.")
        return 1
    order = int(order_str)
    file_path = sys.argv[2]

    # Generate markov chain from string
    file_string = read_file_as_string(file_path)
    all_chunks = get_all_chunks(file_string, chunk_size=order)
    markov_chain = build_markov_chain(all_chunks)

    # Build pseudorandom output
    print(generate_pseudorandom_output(markov_chain))

    return 0


if __name__ == "__main__":
    main()