angular Cell Cursor
===================

Simple excel like spreadsheet development kit for angularJs.

  * display table cell cursor like Excel.
    * user can move cursor by mouse or keyboad ( <kbd>ARROW</kbd> ).
  * range selection like Excel (mouse drag or <kbd>shift</kbd>+<kbd>ARROW</kbd> , <kbd>ESC</kbd> to deselect).
  * user can copy range values to Excel (<kbd>ctrl</kbd>+<kbd>C</kbd>).
  * user can paste range values from Excel (<kbd>ctrl</kbd>+<kbd>V</kbd>).
  * user can edit cell value (<kbd>ENTER</kbd>,<kbd>F2</kbd>, or direct input for example <kbd>a</kbd>).
  * user can drag to resize column or row.
  * Easy to extend.

![capture](https://dl.dropboxusercontent.com/u/196431/2e2b55af748a0224496ba709af86fa80.png)

DEMO
----

http://team-lab.github.io/cell-cursor/example.html

directives
----------

### cell-cursor

`cell-cursor="expression"`

  bind cell-cursor.
  export CellCursor object.

```html
  <div ng-init="items=[{id:1,name:'apple'},{id:2,name:'orange'},{id:3,name:'banana'}]">
    <!-- bind CellCursor to scope.x -->
    <!-- table need tablindex attribute for directive catch keydown events. -->
    <table tabindex="0" cell-cursor="x">
    	<tbody><!-- cursor can move in tbody -->
	    	<tr ng-repeat="i in items">
	    		<td>{{i.id}}</td>
	    		<td>{{i.name}}</td>
	    	</tr>
	    </tbody>
    </table>
    <!-- you can access CellCursor Object -->
    cursor=[{{x.selected.cursor.row}},{{x.selected.cursor.col}}]
  </div>
```

### cell-cursor-copy

`cell-cursor-copy="expression"`

When `copy` called, then set data to clipboard.

```html
  <div ng-app="app" ng-controller="rootCtrl">
    <table tabindex="0" cell-cursor="x" cell-cursor-copy="x.getSelectedCellValues()|cellCursorToTsv">
    	<tbody>
	    	<tr ng-repeat="i in items">
	    		<!-- if you use ng-model on `td`, getSelectedCellValues() get data by ngModelControll.$viewValue -->
	    		<td ng-model="i.id">{{i.id}}</td>
	    		<!-- if you use cell-options on `td`, getSelectedCellValues() get data by getter() -->
	    		<td cell-cursor-options="{getter:getName(i)}">{{i.name}}</td>
	    	</tr>
	    </tbody>
    </table>
  </div>
  <script>
  angular.module('app',['cellCursor'])
  .controller('rootCtrl',['$scope',function($scope){
    $scope.items=[{id:1,name:'apple'},{id:2,name:'orange'},{id:3,name:'banana'}];
		// create getter
		$scope.getName=function(i){
			return function(){
				return "["+i.name+"]";
			}
		}
	}]);
	</script>
```


### cell-cursor-paste

`cell-cursor-paste="expression"`

When press `ctrl+v` called, then get data from clipboard.

Expression scope has `$data` it is clipboard data.

```html
  <div ng-app="app" ng-controller="rootCtrl">
    <table tabindex="0" cell-cursor="x" cell-cursor-paste="x.setSelectedCellValues($data)">
    	<tbody>
	    	<tr ng-repeat="i in items">
	    		<!-- if you use ng-model on `td`, setSelectedCellValues() set data by ngModelControll.$setViewValue -->
	    		<!-- if td has readonly attributes, setSelectedCellValues dose not effect -->
	    		<td ng-model="i.id" ng-readonly="readonly">{{i.id}}</td>
	    		<!-- if you use cell-options on `td`, setSelectedCellValues() set data by setter() -->
	    		<td cell-cursor-options="{setter:setName(i)}">{{i.name}}</td>
	    	</tr>
	    </tbody>
    </table>
    <button ng-click="readonly=!readonly">readonly({{readonly}})</button>
  </div>
  <script>
  angular.module('app',['cellCursor'])
  .controller('rootCtrl',['$scope',function($scope){
    $scope.items=[{id:1,name:'apple'},{id:2,name:'orange'},{id:3,name:'banana'}];
		// create setter
		$scope.setName=function(i){
			return function(v){
				if(v!="badname"){
					return i.name=v;
				}
			}
		}
	}]);
	</script>
```


### cell-cursor-options

`cell-cursor-options="expression"`

set option object. set to cell( td or th ) element.

```json
{
  "setter":"function: cell value setter",
  "getter":"function: cell value getter",
  "model":"string: expression for bind value in scope",
  "input":"string: querySelector for input element(that has ngModel)",
  "editor":"string: editor type name. it defined by cellCursorEditorFactory service",
  "on[event]":"function: called on events"
}
```

Order　of　getters/setter definitions is `getter`|`setter` > `bind` > `ngModel`  > `input`.

Event function signeture is `function (event, option:(cell-cursor-options), cellCursorOptionsController, cellCursor, td:HTMLCellElement):boolean`.

event called now `keydown`|`keypress`|`keydown`|`compositionstart`|`compositionupdate`|`compositionend`|`input` only.

```html
  <div ng-init="items=[{name:'apple'},{name:'orange'},{name:'banana'}]">
    <table cell-cursor="x">
    	<tr ng-repeat="i in items"><td cell-cursor-options="{model:'i.name',editor:'text'}">{{i.name}}</td></tr>
    </table>
  </div>
```

### cell-cursor-drag

`cell-cursor-drag="expression"`

expression indicate `CellCursor` object.

```html
  <div ng-app="app" ng-controller="rootCtrl">
    <table tabindex="0" cell-cursor="x">
      <tbody>
        <tr ng-repeat="i in items">
          <td ng-model="i.id" ng-readonly="readonly" cell-cursor-drag="x">{{i.name}}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <script>
  angular.module('app',['cellCursor'])
  .controller('rootCtrl',['$scope',function($scope){
    $scope.items=[{id:1,name:'apple'},{id:2,name:'orange'},{id:3,name:'banana'}];
    // after initialized handler
    $scope.$on("cellCursor",function(e, cellCursor, name){
      if(name=='x'){
        // set drag handler
        cellCursor.$on("cellCursor.drag",function(e, fromPos, toPos){
          if(fromPos.row!=toPos.row){
            // cut & paste
            var s = $scope.items.splice(fromPos.row,1);
            $scope.items.splice.apply($scope.items,[toPos.row,0].concat(s));
            fromPos.row = toPos.row;
          }else{
            e.preventDefault();
          }
        });
      }
    });
  }]);
  </script>
```

#### Events

cell-cursor-drag emit event to cellCursor.

 * `$emit("cellCursor.drag.start", pos)`
   * on mousedown
 * `$emit("cellCursor.drag", fromPos, toPos)`
   * on mousemove to othre cell
 * `$emit("cellCursor.drag.end", pos)`
   * on mouseup

argument `pos` is target cell position object `{row, col}`.


### cell-cursor-col-resize

drag resize handler. User can drag and resize to column width. ( in html, set style 'max-width' and 'width' to all cell elements. ) and reset by dblclick.

```html
<table>
  <tr>
    <!-- set handler as class name -->
    <!-- wrap content div that has 'overflow:hidden' if you need -->
    <td><div class="cell-cursor-col-resize"></div><div style="overflow:hidden">This name is 'A'.</div></td>
    <td><div class="cell-cursor-col-resize"></div><div style="overflow:hidden">This name is 'B'.</div></td>
    <td><div class="cell-cursor-col-resize"></div><div style="overflow:hidden">This name is 'C'.</div></td>
  </tr>
</table>
```

#### Events

cell-cursor-row-resize emit event to cellCursor.

 * `$emit("cellCursor.colResize.start", pos, size)`
   * on mousedown
   * can cancel by call event.preventDefault().
 * `$emit("cellCursor.colResize.resizing", pos, newSize, oldSize)`
   * on mousemove before resize
   * can cancel by call event.preventDefault().
   * can modify size by modify argument `newSize.width`.
 * `$emit("cellCursor.colResize.resized", pos, size)`
   * on mousemove after resize
 * `$emit("cellCursor.colResize.end`, pos, size)`
   * on mouseup
 * `$emit("cellCursor.colResize.reset`, pos, size)`
   * on dblclick
   * can cancel by call event.preventDefault().

argument `pos` is target cell position object `{row, col}`.
argument `size` is target cell size object `{width, height}`.

### cell-cursor-row-resize

drag resize handler. User can drag and resize to row height. ( in html, set style 'max-height' and 'height' to tr  elements. ) and reset by dblclick.

```html
<table>
  <tr>
    <!-- set handler as class name -->
    <td><div class="cell-cursor-row-resize"></div>A</td>
  </tr>
  <tr>
    <td><div class="cell-cursor-row-resize"></div>B</td>
  </tr>
  <tr>
    <td><div class="cell-cursor-row-resize"></div>C</td>
  </tr>
</table>
```

#### Events

cell-cursor-row-resize emit event to cellCursor.

 * `$emit("cellCursor.rowResize.start", pos, size)`
   * on mousedown
   * can cancel by call event.preventDefault().
 * `$emit("cellCursor.rowResize.resizing", pos, newSize, oldSize)`
   * on mousemove before resize
   * can cancel by call event.preventDefault().
   * can modify size by modify argument `newSize.height`.
 * `$emit("cellCursor.rowResize.resized", pos, size)`
   * on mousemove after resize
 * `$emit("cellCursor.rowResize.end`, pos, size)`
   * on mouseup
 * `$emit("cellCursor.rowResize.reset`, pos, size)`
   * on dblclick
   * can cancel by call event.preventDefault().

argument `pos` is target cell position object `{row, col}`.
argument `size` is target cell size object `{width, height}`.
