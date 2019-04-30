# Required libraries
import requests
import csv
import numpy as np
from bs4 import BeautifulSoup
 
def format_coord(coord):
    ''' format_coord Method
        Format raw text from HTML web page into a string

        Args:
            coord: raw text from web page
        Returns: 
            formatted_array: string with correct format for csv file
                
    '''
    # Instantiate string to return
    formatted_array = ""
    for i in range(len(coord)):
        el = coord[i]
        # Correction for HTML interpreting number 0 as letter O
        if el == 'O':
            el = '0'
        # Correction for HTML interpreting number 1 as letter l
        elif el == 'l':
            el = '1'
        # Negative value for longitude coordinate with 'W' label
        if el == 'W':
            formatted_array += "-"
        # Positive value for longitude coordinate with 'E' label
        elif el == 'E':
            formatted_array += "+"
        # Web page formats coordinates using "degree" notation. Replace
        # degree symbol with decimal symbol
        if el == " " and coord[i+1] == '0' and (coord[i-1].isdigit() or coord[i-1]=='O'):
            formatted_array += "."
        # If the current element is a number and not a "degree" symbol,
        # concatenate it to the string to return
        if el.isdigit() and not (coord[i-1]==" " and el=='0'):
            formatted_array += el
    return formatted_array

# Use the requests library to download the HTML contents of the page 
page = requests.get("http://www.ala.org/rt/magirt/publicationsab/usa")
# Use the BeautifulSoup library to parse the downloaded HTML document
soup = BeautifulSoup(page.content,'html.parser')
# Find the HTML table on the page
table = soup.find("table")

# Use the csv library to open a new .csv file for writing
with open('state_bounding_boxes.csv', 'w', newline='') as csvfile:
    writer = csv.writer(csvfile)
    # Header for csv file
    writer.writerow(['States','West','East','North','South'])
    # For all rows in the table below the header perform the following
    for tr in table.find_all('tr')[1:]:
        # Get all the table cells 
        tds = tr.find_all("td")
        # Don't include data for the District of Columbia, U.S. Virgin Islands, or Puerto Rico
        if tds[0].text == 'District of Columbia' or tds[0].text == 'U. S. Virgin Islands' or tds[0].text == 'Puerto Rico':
            continue
        # Write a new row to the csv file with information for the bounding box coordinate
        # data and corresponding state (derived from the text of the table cells)
        else:
            writer.writerow([tds[0].text,format_coord(tds[1].text),format_coord(tds[2].text),format_coord(tds[3].text),format_coord(tds[4].text)])