import React from 'react';
import ReactDOM from 'react-dom';
import FocusTrap from './FocusTrap';
import HotKeyMapMixin from './HotKeyMapMixin';
import isBool from 'lodash/lang/isBoolean';
import isArray from 'lodash/lang/isArray';
import isObject from 'lodash/lang/isObject';
import forEach from 'lodash/collection/forEach';
import isEqual from 'lodash/lang/isEqual';

function getSequencesFromMap(hotKeyMap, hotKeyName) {
  const sequences = hotKeyMap[hotKeyName];

  // If no sequence is found with this name we assume
  // the user is passing a hard-coded sequence as a key
  if (!sequences) {
    return [hotKeyName];
  }

  if (isArray(sequences)) {
    return sequences;
  }

  return [sequences];
}

const HotKeys = React.createClass({

  mixins: [HotKeyMapMixin()],

  propTypes: {
    onFocus: React.PropTypes.func,
    onBlur: React.PropTypes.func,
    keyMap: React.PropTypes.object,
    handlers: React.PropTypes.object,
    focused: React.PropTypes.bool, // externally controlled focus
    attach: React.PropTypes.any // dom element to listen for key events
  },

  contextTypes: {
    hotKeyParent: React.PropTypes.any
  },

  childContextTypes: {
    hotKeyParent: React.PropTypes.any
  },

  getChildContext() {
    return {
      hotKeyParent: this
    };
  },

  componentDidMount() {
    // import is here to support React's server rendering as Mousetrap immediately
    // calls itself with window and it fails in Node environment
    const Mousetrap = require('mousetrap');
    // Not optimal - imagine hundreds of this component. We need a top level
    // delegation point for mousetrap
    this.__mousetrap__ = new Mousetrap(
      this.props.attach || ReactDOM.findDOMNode(this)
    );

    this.updateHotKeys(true);
  },

  componentDidUpdate(prevProps) {
    this.updateHotKeys(false, prevProps);
  },

  componentWillUnmount() {
    if (this.context.hotKeyParent) {
      this.context.hotKeyParent.childHandledSequence(null);
    }

    if (this.__mousetrap__) {
      this.__mousetrap__.reset();
    }
  },

  updateHotKeys(force = false, prevProps = {}) {
    const {handlers = {}} = this.props;
    const {handlers: prevHandlers = handlers} = prevProps;

    // Ensure map is up-to-date to begin with
    // We will only bother continuing if the map was actually updated
    const updatedMap = this.updateMap();

    if (!force && isEqual(handlers, prevHandlers) && !updatedMap) {
      return;
    }

    this.updateMap();

    const hotKeyMap = this.getMap();
    const sequenceHandlers = [];
    const mousetrap = this.__mousetrap__;

    // Group all our handlers by sequence
    forEach(handlers, (handler, hotKey) => {
      const handlerSequences = getSequencesFromMap(hotKeyMap, hotKey);

      // Could be optimized as every handler will get called across every bound
      // component - imagine making a node a focus point and then having hundreds!
      forEach(handlerSequences, (sequence) => {
        let action;

        const callback = (event, sequence) => {
          // Check we are actually in focus and that a child hasn't already handled this sequence
          const isFocused = isBool(this.props.focused)
            ? this.props.focused
            : this.__isFocused__;

          if (isFocused && sequence !== this.__lastChildSequence__) {
            if (this.context.hotKeyParent) {
              this.context.hotKeyParent.childHandledSequence(sequence);
            }

            return handler(event, sequence);
          }
        };

        if (isObject(sequence)) {
          action = sequence.action;
          sequence = sequence.sequence;
        }

        sequenceHandlers.push({callback, action, sequence});
      });
    });

    // Hard reset our handlers (probably could be more efficient)
    mousetrap.reset();
    forEach(sequenceHandlers, (handler) =>
      mousetrap.bind(handler.sequence, handler.callback, handler.action));
  },

  childHandledSequence(sequence = null) {
    this.__lastChildSequence__ = sequence;

    // Traverse up any hot key parents so everyone is aware a child has handled a certain sequence
    if (this.context.hotKeyParent) {
      this.context.hotKeyParent.childHandledSequence(sequence);
    }
  },

  onFocus() {
    this.__isFocused__ = true;

    if (this.props.onFocus) {
      this.props.onFocus(...arguments);
    }
  },

  onBlur() {
    this.__isFocused__ = false;

    if (this.props.onBlur) {
      this.props.onBlur(...arguments);
    }
  },

  render() {
    return (
      <FocusTrap {...this.props} onFocus={this.onFocus} onBlur={this.onBlur}>
        {this.props.children}
      </FocusTrap>
    )
  }

});

export default HotKeys;
