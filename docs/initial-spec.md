We are building a web application that runs on the browser only.
Do not use any framework unless a framework makes the implementation simpler.
The web application helps with planning to knit a round yoke along with creating
a pattern in a rectangular table including its visualiation as slices of
variable size of the round yoke.

## Input:

The user enters the following data:

* SI as the number of initial stitches
* IP as the number of increase points per round
* SF as the number of final stitches

## Assumptions

* Increase points must be distributed exactly evenly in a round
* 2 stiches are added at every increase point
* The number of rows with increase poits are separated by rounds without
  increases.
  Between every round with increase points there are exactly half as many rows
  without increase points as there are increase points.
  For example, if there are 8 increase points, only every 4th row will have
  increase points.

## Calculator

* Calculate TR as the number of rounds to knit from start (initial stitches)
  until the number of final stitches are achieved.

## Presentation

* The result of nitting the round yoke is a circle with a hole.
  THe outer circumference is the number final stitches.
  The circumference of the hole is the number of initial stiches.
* The presentation shall help with visualizatin how a pattern looks on the final
  piece when knitted.
* The screen should be into two rows:
  The top row takes the input and shows the calculated results and also displays
  the assumptions.
  The lower part takes the visualizatio to apply a pattern
* The visualization is split in two parts:
  on the left is the visualization of the pattern as 1 or more segments of the
  round yoke.
  On the right is the rectangular table to create the pattern.
* The number of segments defines the width of the pattern that can be applied.
  The user shall be able to choose the number of segments to define.
  Segment numbers are limited by the ability to evenly divide the number of
  stitches in each round.
  For example:
  If SI is 3 and SF is 6, only 1 or 3 segments are possible.
  2 segments are not possible because 3 stitches cannnot be evenly distributed
  and more than 3 segments are not possible because there not eneough stitches
  in SI to distribute.
* When the user selects the number of segments, the visualization adapts:
  The width of the segment(s) on the left as well as the width of the pattern
  table.
  The height the segment and the pattern table is fixed to the number of total
  rows TR.
* The segment visualization on the left allows to the number of segments to
  visualize from one segment to all segments being the full circle.
* The pattern table on the right shall be a table whose height is the number of
  TR (total rows) and whose width is the number of final stitches SF.
  Each field in the table represents a stitch.
  The pattern will be drawn by the user by placing a color into a field
  representing a stitch.
  As not all rows have the same number of stitches, the placement of colors will
  be limited by the number of stitches available in the respective row.
  Once all available stiches in a row have been placed, the rest of the fields
  in the row are disabled.
  To reenable, an existing field must be cleared.
* Colors are placed into the table by clicking into the respective field:
   * There will always be a selected color
   * There is a special color "clear" which allows to remove a color placement
   * Clicking into field with no color placed:
     The selected color will be placed (if "clear", this is a no-op)
   * Clicking into a field with a color already placed:
      * If the same color is placed as selected, the field cleared -- clicking
        into the same field with the same color will toggle setting the color
        and clearing the field
      * If another is placed as selected, the existing color is replaced by the
        selected color
      * Corollary:
        If the current color is "clear", the field is cleared by removing the
        existing color
* The left hand visualization should be drawn as a segment of a circle with
  radial rays of colors according to the pattern.
  Clear fields are not colorized in the visualization.
  If there are more clear fields in a pattern row, than there are stitches in
  the actual row, the missing stitches remain are rendered in a markee color.
  The markee color can be user defined and defaults to white.
* To the right of the pattern table (or to the bottom if the screen geometry is
  not wide enough) is a list of color blocks.
  Clicking in a color block selects the color to place in the field.
  By default there is only the "clear" color (which cannot be removed).
  Additional colors can be add and removed.
  When removing a color, any corresponding placed stitches will be cleared.
  An existing color can be modified at any time causing any already placed
  stitches to be adapted to the new color.
* In each row of the pattern table, the increase points shall be visualized.
