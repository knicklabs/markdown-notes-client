(function($) {

  var currentNoteView;

  // Define our note model. Multiple views in this application will listen for
  // changes to this model.
  var Note = Backbone.Model.extend({
    baseUrl: 'http://api.markdown-notes.com/notes/node',

    // Default values.
    defaults: {
      title:  'untitled',
      type:   'note' // Drupal will require a content type.
    },

    idAttribute: 'nid', // Override id to Drupal's unique identifier.

    // Override the URL function to return the URL to be used for GET, POST, PUT, and DELETE
    // requests. Note that we provide a different URL for POST by checking if the model is
    // new (i.e. not persisted).
    url: function() {
      return (this.isNew()) ? this.baseUrl : [this.baseUrl, this.get('nid')].join('/');
    },

    // Here we illustrate how to override the save function to encapsulate mapping some
    // values in our application to values expected by our API.
    save: function(attributes, options) {
      var body = this.get('body');
      this.set('body', {
        "und": {
          "0": {
            "value": body
          }
        }
      });

      // Note how call "super" here to complete the save operation.
      Backbone.Model.prototype.save.apply(this, [attributes, options]);
    },

    // Here we illustrate how to override the get function to convert the body attribute
    // from an object back to a string, as our application expects to deal with a string.
    get: function(attribute) {
      switch (attribute) {
        case 'body':
          var body = this.attributes['body'];

          if (body && typeof body === 'string') {
            return body;
          } else if (body) {
            return body['und']['0']['value'];
          } else {
            return '';
          }
          break;
        default:
          // Note how we call "super" here to handle get() in cases where we are not interested
          // in overriding the functionality.
          return Backbone.Model.prototype.get.call(this, attribute);
      }
    }
  });

  // Define our collection of models.
  var Notes = Backbone.Collection.extend({
    model: Note,   // Note that we specify the type of model our collection contains.
    url: 'http://api.markdown-notes.com/notes/all' // And we provide an endpoint we can use to fetch our collection.
  });

  // We continue defining the rest of our application after the DOM has loaded, since it refers to DOM elements.
  $(document).ready(function() {

    // We define a NoteView, which will handle the display of a single note in our main container.
    var NoteView = Backbone.View.extend({
      id: 'note',
      template: _.template($('#note-template').html()), // We pull the template out of our index.html file.

      // Here we bind the UI events our view will respond to.
      events: {
        'click .save': 'save'
      },

      initialize: function() {
        _.bindAll(this, 'render', 'unrender', 'remove', 'enableSave', 'disableSave', 'save', 'getTitle', 'getBody');

        // And here we listen for changes to our model.
        this.model.bind('change', this.enableSave);
        this.model.bind('remove', this.unrender);
      },

      render: function() {
        var self = this;

        // Render the template into this view's element.
        $(this.el).html(this.template({note: this.model}));
        $('[name=title], [name=body]', this.el).on('keyup', function() {
          self.model.set('title', self.getTitle());
          self.model.set('body', self.getBody());
        });

        if (this.model.isNew()) {
          this.enableSave();
        }

        return this;
      },

      // Handle removing the element. This will be triggered when the model is deleted.
      unrender: function() {
        $('[name=title], [name=body]', this.el).off('keyup');

        $(this.el).remove();
      },

      // Handle saving the model. This will triggered by the UI event we defined earlier.
      save: function() {
        var self = this;

        this.model.save(null, {
          success: self.disableSave,
          error: function() {
            alert('Could not save: ' + self.model.get('title'));
          }
        });
      },

      enableSave: function() {
        $('.save', this.el).removeAttr('disabled');
      },

      disableSave: function() {
        $('.save', this.el).attr('disabled', 'disabled');
      },

      getTitle: function() {
        return $('[name=title]', this.el).val() || 'untitled';
      },

      getBody: function() {
        return $('[name=body]', this.el).val() || ' ';
      }
    });

    // We define an item view, which will handle the display of a single note in our list.
    var ItemView = Backbone.View.extend({
      tagName: 'li',  // Make this.el an 'li' instead of a 'div'
      template: _.template($('#item-template').html()),

      events: {
        'click .remove': 'remove',
        'click .view': 'view'
      },

      initialize: function() {
        _.bindAll(this, 'render', 'unrender', 'remove', 'view');

        this.model.bind('change:title', this.render);
        this.model.bind('remove', this.unrender);
      },

      render: function() {
        var self = this;

        $(this.el).html(this.template({note: this.model}));
        return this;
      },

      unrender: function() {
        $(this.el).remove();
      },

      // remove() is triggered by a UI event we defined. Note that all this does is delete the model. It does not
      // do anything to the DOM directly.
      remove: function() {
        this.model.destroy();
      },

      view: function() {
        if (currentNoteView) {
          currentNoteView.remove(); // Call the remove() on any views that are being disposed of to unbind events.
        }

        currentNoteView = new NoteView({
          model: this.model // Note how we reference this model in the view view we create.
        });

        $('#main').html(currentNoteView.render().el);
        $('#editor textarea').trigger('keyup');
      }
    });


    // We define a view to handle our list of notes. The actual list items are handled by the item view.
    var ListView = Backbone.View.extend({
      el: '#sidebar',
      template: _.template($('#list-template').html()),

      events: {
        'click .add': 'add'
      },

      initialize: function() {
        var self = this;
        _.bindAll(this, 'render', 'add', 'append', 'prepend', 'clearInputs');

        // Note that we can bind events to collections, just like we did with models.
        this.collection = new Notes();
        this.collection.bind('add', this.prepend);
        this.collection.bind('add', this.clearInputs);

        // Here we fetch the collection from the server.
        this.collection.fetch({
          success: self.render // And we render the collection on success. You should handle errors too.
        });
      },

      render: function() {
        var self = this;

        $(this.el).append(this.template());

        // If any models are fetched from the server, we append them to the list in our view.
        _(this.collection.models).each(function(note) {
          self.append(note);
        });
      },

      // Here we handle creating, but not saving, a new model and adding it to the collection.
      add: function() {
        var note = new Note({
          title: $('[name=title]', this.el).val() || 'untitled'
        });

        this.collection.add(note);
      },

      // Here we handle rendering an item in the collection, and appending it to the list in our view.
      append: function(note) {
        var itemView = new ItemView({
          model: note
        });

        $('.list', this.el).append(itemView.render().el);
      },

      // Same as above, but reversed.
      prepend: function(note) {
        var itemView = new ItemView({
          model: note
        });

        $('.list', this.el).prepend(itemView.render().el);
      },

      clearInputs: function() {
        $('[name=title]', this.el).val('');
      }
    });

    // Initialize the app
    $('body').prepend(_.template($('#main-template').html())());

    new ListView(); // It all starts here.

    // This is non-Backbone code to do a live preview of our markdown.
    var converter = new Showdown.converter();
    $('#main').delegate('#editor textarea', 'keyup', function() {
      $('#preview').html(converter.makeHtml($('#editor textarea').val()));
    });

  }); // document.ready

})(jQuery);